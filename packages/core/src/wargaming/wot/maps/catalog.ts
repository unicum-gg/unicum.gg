import type { Region, WotSrcArena } from "@unicum.gg/wargaming";
import {
  buildMapSlugIndex,
  mapDisplayName,
  minimapUrl,
  variantOf,
  type MapSlugIndex,
} from "@unicum.gg/shared";
import { getRedisClient } from "@unicum.gg/core/redis";
import { wg } from "../../client";

export type MapCatalog = {
  /** Deduped arenas keyed by arena id. */
  arenas: Map<string, WotSrcArena>;
  index: MapSlugIndex;
  /** Night Onslaught arenas, keyed by the map they are a version of. They are
   * deliberately absent from `arenas`: they are that map played in Onslaught
   * after dark, not a map to list beside it. */
  onslaughtArenas: Map<string, WotSrcArena[]>;
  /** Of those, the ones the live client only declares: it ships no space for
   * them, so they can only be played on the Common Test. */
  testOnlyArenas: Set<string>;
};

// The catalogue derives from static client scripts (only a game patch changes
// it) and the underlying wot-src fetches are themselves cached for a day, so a
// coarse memo per region is plenty and keeps the list/detail routes off the
// network on every hit.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REDIS_TTL_SECONDS = 24 * 60 * 60;
// Bumped whenever a new field is read off the cached arenas or the payload's own
// shape changes: a payload written by the previous deploy is otherwise a day of
// `undefined` on anything that shipped with this one. Bumped too when name
// resolution changes, since the names are resolved before the array is
// serialized and a stale payload would keep serving the previous spelling (and
// therefore the previous slugs) for a day.
const SHAPE_VERSION = 4;
const redisKey = (region: Region) => `mapcatalog:v${SHAPE_VERSION}:${region}`;
const cache = new Map<Region, { value: MapCatalog; expiresAt: number }>();

// The whole catalogue rebuilds deterministically from the sorted+deduped arena
// array (the id map, the slug index and the fold below all derive from it), so
// that array is the only thing we serialize to share across workers. It holds
// every arena, folded ones included, since which of them is a map of its own is
// what this rebuilds.
type CatalogPayload = {
  arenas: WotSrcArena[];
  /** Arena ids the live client declares without shipping their space. */
  testOnly: string[];
};

function catalogFromArenas(payload: CatalogPayload): MapCatalog {
  const all = payload.arenas;
  const onslaughtArenas = new Map<string, WotSrcArena[]>();
  const folded: [WotSrcArena, string][] = [];
  const maps: WotSrcArena[] = [];
  for (const arena of all) {
    const variant = variantOf(arena.arenaId);
    if (variant?.foldedIntoBase) folded.push([arena, variant.baseId]);
    else maps.push(arena);
  }
  const byId = new Map(maps.map((a) => [a.arenaId, a]));
  let orphans = false;
  for (const [arena, baseId] of folded) {
    // A fold with no base map left to fold onto would drop the arena from the
    // catalogue entirely, so it keeps its own card instead: Wargaming retiring
    // the base map should cost us a name, not a map.
    if (!byId.has(baseId)) {
      maps.push(arena);
      byId.set(arena.arenaId, arena);
      orphans = true;
      continue;
    }
    const list = onslaughtArenas.get(baseId);
    if (list) list.push(arena);
    else onslaughtArenas.set(baseId, [arena]);
  }
  // The caller hands the arenas over name-sorted and both the id map and the
  // slug index inherit that order, so an orphan appended above has to be sorted
  // back in rather than left at the end (the sitemap reads this order).
  if (orphans) maps.sort((a, b) => a.name.localeCompare(b.name));
  const listed = orphans ? new Map(maps.map((a) => [a.arenaId, a])) : byId;
  return {
    arenas: listed,
    index: buildMapSlugIndex(maps),
    onslaughtArenas,
    testOnlyArenas: new Set(payload.testOnly),
  };
}

// Long enough for a mirror round trip, short enough that a slow one cannot hold
// the catalogue build hostage.
const MINIMAP_PROBE_TIMEOUT_MS = 5000;

/**
 * The folded arenas the live client only declares, read off the minimap mirror.
 *
 * The mirror is extracted from the client's own packages, so it publishes an
 * image for every space the live client ships and none for a space it does not:
 * a 404 on the live branch is an arena the client names without carrying, which
 * is exactly the state the 2.4 night versions are in (their packages are on the
 * Common Test alone). Derived rather than listed, so an arena stops being
 * flagged the day its package ships, and the probe is only paid for the handful
 * of folded arenas rather than for the whole catalogue.
 *
 * Fails towards "shipped": a mirror blip must not label a live map as test-only.
 */
async function findTestOnlyArenas(ids: string[]): Promise<string[]> {
  const checked = await Promise.all(
    ids.map(async (arenaId) => {
      try {
        const res = await fetch(minimapUrl(arenaId), {
          method: "HEAD",
          signal: AbortSignal.timeout(MINIMAP_PROBE_TIMEOUT_MS),
        });
        return res.ok ? null : arenaId;
      } catch {
        return null;
      }
    }),
  );
  return checked.filter((id) => id !== null);
}

/**
 * Resolve each arena's display name in place, disambiguating event/mode variants
 * against their base map ("14_siegfried_line_wt" -> "Siegfried Line
 * (Waffenträger)", "120_graf_zeppelin_ls26_2" -> "Nordskar (Last Stand)"). A
 * variant borrows its base's name, so the resolver is recursive + memoized.
 *
 * Exported because the history pipeline resolves the names of a past version's
 * arenas the same way: a map's name is how it is told apart from the different
 * map that later re-used its arena id.
 */
export function resolveArenaNames(raw: WotSrcArena[]): void {
  const rawById = new Map(raw.map((a) => [a.arenaId, a]));
  const poName = (id: string) => rawById.get(id)?.name;
  const nameCache = new Map<string, string>();
  const nameOf = (id: string): string => {
    const hit = nameCache.get(id);
    if (hit !== undefined) return hit;
    const name = mapDisplayName(id, poName(id), nameOf);
    nameCache.set(id, name);
    return name;
  };
  for (const arena of raw) arena.name = nameOf(arena.arenaId);
}

// After name resolution, distinct maps carry distinct names, so this only folds
// away true duplicates (the same map shipped under two ids), keeping the
// shortest, canonical id.
function dedupeByName(arenas: WotSrcArena[]): WotSrcArena[] {
  const byName = new Map<string, WotSrcArena>();
  for (const arena of arenas) {
    const existing = byName.get(arena.name);
    if (!existing || arena.arenaId.length < existing.arenaId.length) {
      byName.set(arena.name, arena);
    }
  }
  return [...byName.values()];
}

/** The region's battle-map catalogue (named + deduped arenas + slug index),
 * memoized. Every arena the client ships is included; the app's battle-type
 * filter decides what surfaces where. */
export async function getMapCatalog(region: Region): Promise<MapCatalog> {
  const cached = cache.get(region);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  // Shared Redis layer between the per-process memo and the (~600ms) build: the
  // in-memory cache lives per worker, so under the PM2 cluster every worker used
  // to rebuild the catalogue independently (and again per TTL). Reading a built
  // catalogue from Redis instead means only the first worker to miss pays the
  // build. Fails open: no Redis (local dev) or a blip just falls through to it.
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(redisKey(region));
      if (raw) {
        const value = catalogFromArenas(JSON.parse(raw) as CatalogPayload);
        cache.set(region, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value;
      }
    } catch {
      // fall through to a fresh build
    }
  }

  const raw = await wg.region(region).source.arenas.catalog();
  resolveArenaNames(raw);
  const arenas = dedupeByName(raw).sort((a, b) => a.name.localeCompare(b.name));
  const folded = arenas
    .filter((a) => variantOf(a.arenaId)?.foldedIntoBase)
    .map((a) => a.arenaId);
  const payload: CatalogPayload = {
    arenas,
    testOnly: await findTestOnlyArenas(folded),
  };
  const value = catalogFromArenas(payload);
  cache.set(region, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (redis) {
    try {
      await redis.set(
        redisKey(region),
        JSON.stringify(payload),
        "EX",
        REDIS_TTL_SECONDS,
      );
    } catch {
      // best effort: the in-memory memo still serves this worker
    }
  }
  return value;
}
