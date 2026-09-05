import type { Region, WotSrcArena } from "@unicum.gg/wargaming";
import {
  buildMapSlugIndex,
  ctMinimapUrl,
  minimapUrl,
  resolveMapName,
  variantOf,
  type MapSlugIndex,
  type ResolvedMapName,
} from "@unicum.gg/shared";
import { getRedisClient } from "@unicum.gg/core/redis";
import { wg } from "../../client";

export type MapCatalog = {
  /** Deduped arenas keyed by arena id. */
  arenas: Map<string, WotSrcArena>;
  index: MapSlugIndex;
  /** The variant arenas of each map, keyed by the map they belong to: the
   * Waffenträger and Last Stand reskins, the Story Mode chapters, the Onslaught
   * night versions. They are deliberately absent from `arenas`: each is that map
   * played somewhere else, not a map to list beside it. */
  variantArenas: Map<string, WotSrcArena[]>;
  /** The arenas the live client only declares: it ships no space for them, so
   * they can only be played on the Common Test. */
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
// One build per region at a time, like the Clan Wars pool next door. The memo
// is only written once the build resolves, so without this every request that
// arrives during a cold build starts its own: the whole wot-src fetch and the
// probe sweep below, N times over, which is the shape of the cold-start herd
// that has taken pages down here before.
const inflight = new Map<Region, Promise<MapCatalog>>();

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
  const variantArenas = new Map<string, WotSrcArena[]>();
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
    const list = variantArenas.get(baseId);
    if (list) list.push(arena);
    else variantArenas.set(baseId, [arena]);
  }
  // The caller hands the arenas over name-sorted and both the id map and the
  // slug index inherit that order, so an orphan appended above has to be sorted
  // back in rather than left at the end (the sitemap reads this order).
  if (orphans) maps.sort((a, b) => a.name.localeCompare(b.name));
  const listed = orphans ? new Map(maps.map((a) => [a.arenaId, a])) : byId;
  return {
    arenas: listed,
    index: buildMapSlugIndex(maps),
    variantArenas,
    testOnlyArenas: new Set(payload.testOnly),
  };
}

// Long enough for a mirror round trip, short enough that a slow one cannot hold
// the catalogue build hostage.
const MINIMAP_PROBE_TIMEOUT_MS = 5000;
// How many minimap probes are in flight at once. The sweep runs once a day per
// region behind the caches, so its wall time barely matters, and the mirror is
// a shared GitHub host.
const PROBE_CONCURRENCY = 8;

/**
 * The arenas the live client only declares, read off the minimap mirror.
 *
 * The mirror is extracted from the client's own packages, so it publishes an
 * image for every space the live client ships and none for a space it does not.
 * An arena missing from the live branch but present on the test one is therefore
 * an arena the live client names without carrying, which is the state update
 * 2.4 left ten of them in (four night versions, three Waffenträger reskins and
 * the three arcade minigames): declared everywhere, playable only on the test.
 *
 * Both halves are needed. A live 404 alone would also catch the legacy event
 * arenas that have no HD image anywhere, and calling those Common Test would be
 * plainly wrong. Derived rather than listed, so an arena stops being flagged the
 * day its package ships.
 *
 * Fails towards "shipped": a mirror blip must not label a live map as test-only.
 */
async function findTestOnlyArenas(ids: string[]): Promise<string[]> {
  const exists = async (url: string | null): Promise<boolean> => {
    if (url === null) return false;
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(MINIMAP_PROBE_TIMEOUT_MS),
      });
      return res.ok;
    } catch {
      return false;
    }
  };
  const testOnly: string[] = [];
  const queue = [...ids];
  // A worker pool rather than one request per arena at once: this is a hundred
  // odd arenas, and firing every HEAD simultaneously at a mirror we do not own
  // is how a burst gets throttled. A 429 on the live probe followed by an
  // answer on the test one is the one combination that would mislabel a live
  // map, so the sweep stays deliberately unhurried.
  const worker = async () => {
    while (queue.length > 0) {
      const arenaId = queue.pop()!;
      const live = minimapUrl(arenaId);
      if (await exists(live)) continue;
      if (await exists(ctMinimapUrl(live))) testOnly.push(arenaId);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, ids.length) }, worker),
  );
  return testOnly;
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
 *
 * Returns the arena ids whose name is a humanized id rather than a real one,
 * which the client leaves us for the days between an update's definitions and
 * its strings. They are named well enough to draw a card, and must not be
 * recorded: see `ResolvedMapName.resolved`.
 */
export function resolveArenaNames(raw: WotSrcArena[]): Set<string> {
  const rawById = new Map(raw.map((a) => [a.arenaId, a]));
  const poName = (id: string) => rawById.get(id)?.name;
  const nameCache = new Map<string, ResolvedMapName>();
  const nameOf = (id: string): ResolvedMapName => {
    const hit = nameCache.get(id);
    if (hit !== undefined) return hit;
    const resolved = resolveMapName(id, poName(id), nameOf);
    nameCache.set(id, resolved);
    return resolved;
  };
  const unnamed = new Set<string>();
  for (const arena of raw) {
    const { name, resolved } = nameOf(arena.arenaId);
    arena.name = name;
    if (!resolved) unnamed.add(arena.arenaId);
  }
  return unnamed;
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

  const existing = inflight.get(region);
  if (existing) return existing;
  const promise = buildMapCatalog(region).finally(() => inflight.delete(region));
  inflight.set(region, promise);
  return promise;
}

async function buildMapCatalog(region: Region): Promise<MapCatalog> {
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
  const payload: CatalogPayload = {
    arenas,
    testOnly: await findTestOnlyArenas(arenas.map((a) => a.arenaId)),
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
