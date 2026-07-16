import { getRedisClient } from "@unicum.gg/core/redis";
import type { Region } from "@unicum.gg/wargaming";

// Which on-demand refresh queue a latency sample belongs to. Players and clans
// have separate queues, crons and rate-limiter pressure, so their ETAs are
// measured independently.
export enum RefreshSubject {
  Player = "player",
  Clan = "clan",
}

// Rolling window over which we measure live refresh latency. Sized for the
// sparse regions: on a quiet region an on-demand refresh may land only once
// every few minutes, so a 60s window is almost always empty and the ETA falls
// back to the optimistic default even when the real processing time is high
// (e.g. EU at ~37s while the backfill saturates the rate limiter). 10 min keeps
// those rare samples alive; load varies on a minutes scale, so it stays timely.
const WINDOW_MS = 600_000;
// A single refresh's processing time never legitimately reaches this; a sample
// above it means something stalled, so drop it rather than poison the p75.
const MAX_SANE_LATENCY_MS = 60_000;

const key = (subject: RefreshSubject, region: Region) =>
  `refresh:latency:${subject}:${region}`;

// In-process fallback when Redis is unset (local single-process dev): recent
// (timestamp, latency) pairs per subject+region. Useless across processes,
// which is exactly why prod (worker writes, web reads) needs Redis.
const memory = new Map<string, Array<{ t: number; ms: number }>>();

/**
 * Record the processing time (WG fetch to snapshot written) of one completed
 * live refresh for `subject` in `region`. A single signal that folds in
 * WG/G-Core latency, rate-limiter contention from the backfill cron and
 * retries, none of which a formula can predict. Deliberately not
 * enqueue-to-completion: `enqueue` pins queued_at to the earliest interest via
 * LEAST(), which would inflate the p75 with "time since first viewer" for
 * popular entities. Fire-and-forget: a Redis blip must never slow a refresh.
 */
export function recordRefreshLatency(
  subject: RefreshSubject,
  region: Region,
  ms: number,
): void {
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_SANE_LATENCY_MS) return;
  const now = Date.now();
  const k = key(subject, region);
  const redis = getRedisClient();
  if (redis) {
    // Score = timestamp for windowing; member encodes the latency (unique per
    // completion via `ts-ms`). Trim the window on write.
    void redis
      .multi()
      .zadd(k, now, `${now}-${ms}`)
      .zremrangebyscore(k, 0, now - WINDOW_MS)
      .exec()
      .catch(() => {});
    return;
  }
  const list = (memory.get(k) ?? []).filter((e) => e.t > now - WINDOW_MS);
  list.push({ t: now, ms });
  memory.set(k, list);
}

// Nearest-rank 75th percentile of a numeric sample (ascending).
function p75(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil(0.75 * sorted.length);
  return sorted[Math.min(sorted.length, rank) - 1];
}

/**
 * The 75th-percentile live-refresh latency for `subject` in `region` over the
 * rolling window, in milliseconds. Null when there's no recent signal (cold
 * start / quiet region / Redis down), so callers fall back to a theoretical
 * estimate.
 */
export async function getRefreshLatencyMs(
  subject: RefreshSubject,
  region: Region,
): Promise<number | null> {
  const now = Date.now();
  const since = now - WINDOW_MS;
  const k = key(subject, region);
  const redis = getRedisClient();
  if (redis) {
    try {
      const members = await redis.zrangebyscore(k, since, now);
      const samples = members
        .map((m) => Number(m.slice(m.indexOf("-") + 1)))
        .filter((n) => Number.isFinite(n));
      return samples.length > 0 ? p75(samples) : null;
    } catch {
      return null;
    }
  }
  const samples = (memory.get(k) ?? [])
    .filter((e) => e.t > since)
    .map((e) => e.ms);
  return samples.length > 0 ? p75(samples) : null;
}
