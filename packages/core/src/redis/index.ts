import Redis from "ioredis";
import { env } from "@unicum.gg/shared";

/**
 * Redis connections, currently used only for live pub/sub (LiveSync SSE fanned
 * out across processes/instances — see services/live/pubsub).
 *
 * Returns null when `REDIS_URL` is unset, which is the signal for callers to
 * fall back to their in-process behaviour (local dev, single process). A
 * subscriber connection can't issue ordinary commands once subscribed, so the
 * publisher and subscriber are separate. Both hang off `globalThis` so Next.js
 * (which can evaluate a module more than once — instrumentation vs route
 * handlers) reuses a single pair instead of leaking connections.
 */

export type RedisPubSub = { publisher: Redis; subscriber: Redis };

declare global {
  // undefined = not resolved yet; null = resolved to "no Redis configured".
  var __redisPubSub: RedisPubSub | null | undefined;
  var __redisClient: Redis | null | undefined;
}

/**
 * A shared general-purpose command connection (distinct from the pub/sub pair,
 * whose subscriber can't issue ordinary commands). Backs the WG SDK's cross-
 * instance cache + rate-limit stores. Null when `REDIS_URL` is unset → callers
 * fall back to in-process behaviour.
 */
export function getRedisClient(): Redis | null {
  if (globalThis.__redisClient !== undefined) return globalThis.__redisClient;

  const url = env.REDIS_URL;
  if (!url) {
    globalThis.__redisClient = null;
    return null;
  }

  // This connection sits in the WG hot path (cache + rate-limit on every call),
  // so commands fail fast (2s) rather than queueing forever — the stores treat
  // an error as a miss / no-limit so a Redis blip never stalls WG traffic.
  const client = new Redis(url, { maxRetriesPerRequest: 2, commandTimeout: 2_000 });
  client.on("error", (err) => console.error("[redis] client error:", err.message));
  globalThis.__redisClient = client;
  return globalThis.__redisClient;
}

/**
 * Read-through JSON cache backed by the shared Redis command connection.
 *
 * Unlike Next's `unstable_cache` (in-process, wiped on every deploy, per-
 * instance), this survives restarts and is shared across instances — so the
 * expensive wot-src fetch+parse behind each tank page is paid at most once per
 * `ttlSeconds` across the whole fleet, and a deploy no longer means every tank
 * is cold. Fails open in every direction: no `REDIS_URL` (local dev), a Redis
 * blip, or an unparseable value all fall through to `compute()`, so a cache
 * problem is only ever a slowdown, never an error. `compute`'s result must be
 * JSON-serialisable (the wot-src datasets are plain game data — no Dates).
 */
export async function cachedInRedis<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const redis = getRedisClient();
  if (!redis) return compute();
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    // Redis miss/blip/parse error → recompute below.
  }
  const value = await compute();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Best-effort write; a failed set just means the next read recomputes.
  }
  return value;
}

export function getRedisPubSub(): RedisPubSub | null {
  if (globalThis.__redisPubSub !== undefined) return globalThis.__redisPubSub;

  const url = env.REDIS_URL;
  if (!url) {
    globalThis.__redisPubSub = null;
    return null;
  }

  // maxRetriesPerRequest: null keeps commands queued across reconnects rather
  // than failing — the right trade-off for long-lived pub/sub connections.
  const publisher = new Redis(url, { maxRetriesPerRequest: null });
  const subscriber = new Redis(url, { maxRetriesPerRequest: null });
  publisher.on("error", (err) =>
    console.error("[redis] publisher error:", err.message),
  );
  subscriber.on("error", (err) =>
    console.error("[redis] subscriber error:", err.message),
  );

  globalThis.__redisPubSub = { publisher, subscriber };
  return globalThis.__redisPubSub;
}
