import { getRedisClient } from "@unicum.gg/core/redis";
import type { Region } from "@unicum.gg/wargaming";

// Rolling window over which we measure the live refresh throughput. Long enough
// to smooth out per-batch bursts, short enough to react to a throttling spell.
const WINDOW_MS = 60_000;

const key = (region: Region) => `refresh:completions:${region}`;

// In-process fallback when Redis is unset (local single-process dev): a plain
// list of completion timestamps per region. Useless across processes, which is
// exactly why prod (worker writes, web reads) needs Redis.
const memory = new Map<Region, number[]>();

/**
 * Record that the live refresh cron just completed one player in `region`. The
 * completion RATE of this cron is our throughput signal for the queue ETA: it
 * already folds in the WG rate limiter, G-Core throttling, retries and
 * contention from the backfill cron, none of which a formula can predict.
 * Fire-and-forget: a Redis blip must never slow a refresh.
 */
export function recordRefreshCompletion(
  region: Region,
  accountId: number,
): void {
  const now = Date.now();
  const redis = getRedisClient();
  if (redis) {
    // Unique member per completion (`ts-accountId`); trim the window on write.
    void redis
      .multi()
      .zadd(key(region), now, `${now}-${accountId}`)
      .zremrangebyscore(key(region), 0, now - WINDOW_MS)
      .exec()
      .catch(() => {});
    return;
  }
  const list = memory.get(region) ?? [];
  list.push(now);
  memory.set(
    region,
    list.filter((t) => t > now - WINDOW_MS),
  );
}

/**
 * Measured live-refresh throughput for `region`, in players per second over the
 * last minute. Null when there's no recent signal (cold start / Redis down), so
 * callers fall back to a theoretical rate.
 */
export async function getRefreshThroughput(
  region: Region,
): Promise<number | null> {
  const now = Date.now();
  const since = now - WINDOW_MS;
  const redis = getRedisClient();
  if (redis) {
    try {
      const count = await redis.zcount(key(region), since, now);
      return count > 0 ? count / (WINDOW_MS / 1000) : null;
    } catch {
      return null;
    }
  }
  const list = (memory.get(region) ?? []).filter((t) => t > since);
  return list.length > 0 ? list.length / (WINDOW_MS / 1000) : null;
}
