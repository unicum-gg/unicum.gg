import type { Region, WotSrcArena } from "@unicum.gg/wargaming";
import {
  buildMapSlugIndex,
  mapDisplayName,
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
};

// The catalogue derives from static client scripts (only a game patch changes
// it) and the underlying wot-src fetches are themselves cached for a day, so a
// coarse memo per region is plenty and keeps the list/detail routes off the
// network on every hit.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REDIS_TTL_SECONDS = 24 * 60 * 60;
// Bumped whenever a new field is read off the cached arenas: the value is the
// serialized `WotSrcArena[]`, so a payload written by the previous deploy is a
// day of `undefined` on any field that shipped with this one. Bumped too when
// name resolution changes, since the names are resolved before the array is
// serialized and a stale payload would keep serving the previous spelling (and
// therefore the previous slugs) for a day.
const SHAPE_VERSION = 3;
const redisKey = (region: Region) => `mapcatalog:v${SHAPE_VERSION}:${region}`;
const cache = new Map<Region, { value: MapCatalog; expiresAt: number }>();

// The whole catalogue rebuilds deterministically from the sorted+deduped arena
// array (the id map, the slug index and the fold below all derive from it), so
// that array is the only thing we serialize to share across workers. It holds
// every arena, folded ones included, since which of them is a map of its own is
// what this rebuilds.
function catalogFromArenas(all: WotSrcArena[]): MapCatalog {
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
  if (orphans) {
    maps.sort((a, b) => a.name.localeCompare(b.name));
    return {
      arenas: new Map(maps.map((a) => [a.arenaId, a])),
      index: buildMapSlugIndex(maps),
      onslaughtArenas,
    };
  }
  return { arenas: byId, index: buildMapSlugIndex(maps), onslaughtArenas };
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
        const value = catalogFromArenas(JSON.parse(raw) as WotSrcArena[]);
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
  const value = catalogFromArenas(arenas);
  cache.set(region, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (redis) {
    try {
      await redis.set(
        redisKey(region),
        JSON.stringify(arenas),
        "EX",
        REDIS_TTL_SECONDS,
      );
    } catch {
      // best effort: the in-memory memo still serves this worker
    }
  }
  return value;
}
