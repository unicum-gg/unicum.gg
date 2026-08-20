import type { Region } from "@unicum.gg/wargaming";
import { getRedisClient } from "@unicum.gg/core/redis";

/**
 * Short-TTL Redis cache of the fully-serialized comparison JSON response.
 *
 * The same reasoning as `detail-cache`, and more of it: a comparison assembles
 * the whole tank dataset plus seven per-vehicle sources for up to four vehicles,
 * and its page is `force-dynamic`, so without this every navigation and every
 * shared link re-runs all of it. Nothing in the payload changes between game
 * patches or outside the daily crons, so a plain TTL cache needs no
 * invalidation.
 *
 * Keyed by the vehicles in the order they are compared, since that order is what
 * the response is built in. There is no warm cron behind it (comparisons are an
 * unbounded set of combinations, unlike the ~1200 tank pages), so the TTL is the
 * short one of a read-through cache rather than the detail's daily figure: long
 * enough that a link doing the rounds in a Discord channel is assembled once,
 * short enough that it follows the daily data within the hour.
 */
export const TANK_COMPARE_TTL_SECONDS = 60 * 60;

function key(region: Region, slugs: string[]): string {
  return `tankcompare:${region}:${slugs.map((s) => s.toLowerCase()).join(",")}`;
}

/** Cached JSON body for this comparison, or null on miss / no Redis. */
export async function getCachedTankCompareJson(
  region: Region,
  slugs: string[],
): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return await redis.get(key(region, slugs));
  } catch {
    return null; // fail open: a Redis blip degrades to "no cache", never an error
  }
}

/** Store the serialized comparison JSON. Best-effort. */
export async function setCachedTankCompareJson(
  region: Region,
  slugs: string[],
  json: string,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(key(region, slugs), json, "EX", TANK_COMPARE_TTL_SECONDS);
  } catch {
    // ignore — caching is best-effort
  }
}
