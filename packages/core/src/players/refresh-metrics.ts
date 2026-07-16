import { getRedisClient } from "@unicum.gg/core/redis";
import type { Region } from "@unicum.gg/wargaming";

// Rolling window over which we measure live refresh latency. Long enough to
// smooth out per-refresh noise, short enough to react to a throttling spell or
// a backfill burst saturating the rate limiter.
const WINDOW_MS = 60_000;
// Ignore an entry whose measured latency exceeds this: a paused cron or a stale
// row would otherwise poison the percentile with a bogus multi-minute sample.
const MAX_SANE_LATENCY_MS = 120_000;

const key = (region: Region) => `refresh:latency:${region}`;

// In-process fallback when Redis is unset (local single-process dev): recent
// (timestamp, latency) pairs per region. Useless across processes, which is
// exactly why prod (worker writes, web reads) needs Redis.
const memory = new Map<Region, Array<{ t: number; ms: number }>>();

/**
 * Record the end-to-end latency (enqueue to snapshot written) of one completed
 * live refresh in `region`. A single signal that folds in WG/G-Core latency,
 * rate-limiter contention from the backfill cron, retries and any queue wait,
 * none of which a formula can predict. Fire-and-forget: a Redis blip must never
 * slow a refresh.
 */
export function recordRefreshLatency(region: Region, ms: number): void {
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_SANE_LATENCY_MS) return;
  const now = Date.now();
  const redis = getRedisClient();
  if (redis) {
    // Score = timestamp for windowing; member encodes the latency (unique per
    // completion via `ts-ms-region`). Trim the window on write.
    void redis
      .multi()
      .zadd(key(region), now, `${now}-${ms}`)
      .zremrangebyscore(key(region), 0, now - WINDOW_MS)
      .exec()
      .catch(() => {});
    return;
  }
  const list = (memory.get(region) ?? []).filter((e) => e.t > now - WINDOW_MS);
  list.push({ t: now, ms });
  memory.set(region, list);
}

// Nearest-rank 75th percentile of a numeric sample (ascending).
function p75(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil(0.75 * sorted.length);
  return sorted[Math.min(sorted.length, rank) - 1];
}

/**
 * The 75th-percentile live-refresh latency for `region` over the last minute,
 * in milliseconds. Null when there's no recent signal (cold start / quiet
 * region / Redis down), so callers fall back to a theoretical estimate.
 */
export async function getRefreshLatencyMs(
  region: Region,
): Promise<number | null> {
  const now = Date.now();
  const since = now - WINDOW_MS;
  const redis = getRedisClient();
  if (redis) {
    try {
      const members = await redis.zrangebyscore(key(region), since, now);
      const samples = members
        .map((m) => Number(m.slice(m.indexOf("-") + 1)))
        .filter((n) => Number.isFinite(n));
      return samples.length > 0 ? p75(samples) : null;
    } catch {
      return null;
    }
  }
  const samples = (memory.get(region) ?? [])
    .filter((e) => e.t > since)
    .map((e) => e.ms);
  return samples.length > 0 ? p75(samples) : null;
}
