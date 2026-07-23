import type { Region } from "@unicum.gg/wargaming";
import { getRedisClient } from "@unicum.gg/core/redis";

/**
 * Short-TTL Redis cache of the fully-serialized player-detail JSON response.
 *
 * Why: link-following crawlers re-hit a small set of player pages continuously
 * across all regions, and the detail endpoint has no payload cache — every hit
 * replays the whole query set (player CTE + name-history + tank `DISTINCT ON`
 * over all history + subscription + clan history) and decodes hundreds of wide
 * rows on the single render thread. Measured in prod: that flood alone pins the
 * web JS thread at ~1.2 cores with essentially no real traffic.
 *
 * The TTL is only a safety net. Freshness comes from {@link bustPlayerDetailCache},
 * called wherever a fresh snapshot is committed (`recordCurrentSnapshot`), so a
 * completed refresh — background pipeline, on-demand cron, or cold-DB live fetch
 * — makes the new data visible on the very next request instead of after expiry.
 * That fires on the same event as the LiveSync publish, so the cache and the SSE
 * push stay in lockstep.
 */
export const PLAYER_DETAIL_TTL_SECONDS = 60;

function key(region: Region, nickname: string): string {
  return `pdetail:${region}:${nickname.toLowerCase()}`;
}

/** Cached JSON body for this (region, nickname), or null on miss / no Redis. The
 * payload is metric-agnostic, so there is a single entry per player. */
export async function getCachedPlayerDetailJson(
  region: Region,
  nickname: string,
): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return await redis.get(key(region, nickname));
  } catch {
    return null; // fail open: a Redis blip degrades to "no cache", never an error
  }
}

/** Store the serialized detail JSON. Best-effort. */
export async function setCachedPlayerDetailJson(
  region: Region,
  nickname: string,
  json: string,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(key(region, nickname), json, "EX", PLAYER_DETAIL_TTL_SECONDS);
  } catch {
    // ignore — caching is best-effort
  }
}

/**
 * Invalidate a player's cached detail. Call this whenever a fresh snapshot is
 * committed so a refresh becomes visible immediately. Fire-and-forget and
 * fail-open: a delete failure just leaves the (TTL-bounded) stale entry.
 */
export function bustPlayerDetailCache(region: Region, nickname: string): void {
  const redis = getRedisClient();
  if (!redis) return;
  void redis.del(key(region, nickname)).catch(() => {});
}
