import type { Region } from "@unicum.gg/wargaming";
import { getRedisClient } from "@unicum.gg/core/redis";

/**
 * Short-TTL Redis cache of the fully-serialized tank-detail JSON response.
 *
 * The tank-detail endpoint assembles ~16 sources per call (top players, specs,
 * MoE/MoM + history, research path, modules, the five wot-src fetchers, …) and
 * the page is `force-dynamic`, so every client navigation re-ran the whole
 * assembly — measured at 0.5–2.9s per nav in prod, versus ~50ms for the static
 * pages. Everything in the payload is static between game patches or refreshed
 * by daily crons (top players, MoE), so a plain TTL cache of the serialized
 * payload makes repeat navigations near-instant with no invalidation needed:
 * daily-granularity data is always fresh enough within 30 minutes.
 *
 * We cache the serialized string (not the object) so `Date`s stay ISO strings —
 * revived client-side by the shared response schema — exactly like the API's own
 * `Response.json`, and so a hit skips re-serialization too.
 *
 * The worker's `tank-warm` cron proactively refreshes every tank daily (bust +
 * re-fetch), so entries no longer rely on a visitor to (re)populate them. The
 * TTL is therefore set just above the daily warm interval: long enough that a
 * warmed entry never lapses back to cold between two runs (so navigation stays
 * instant across the whole catalogue), while the daily bust keeps the payload
 * within one day of the source's daily-granularity crons.
 */
export const TANK_DETAIL_TTL_SECONDS = 26 * 60 * 60;

function key(region: Region, slug: string): string {
  return `tankdetail:${region}:${slug.toLowerCase()}`;
}

/** Cached JSON body for this (region, slug), or null on miss / no Redis. */
export async function getCachedTankDetailJson(
  region: Region,
  slug: string,
): Promise<string | null> {
  // Dev-only escape hatch for the endpoint speed bench: force a miss so the
  // handler actually assembles the payload (with warm sub-caches), never a hit.
  if (process.env.PERF_BYPASS_PAYLOAD_CACHE === "1") return null;
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return await redis.get(key(region, slug));
  } catch {
    return null; // fail open: a Redis blip degrades to "no cache", never an error
  }
}

/** Store the serialized tank-detail JSON. Best-effort. */
export async function setCachedTankDetailJson(
  region: Region,
  slug: string,
  json: string,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(key(region, slug), json, "EX", TANK_DETAIL_TTL_SECONDS);
  } catch {
    // ignore — caching is best-effort
  }
}
