import Redis from "ioredis";
import { env } from "@unicum.gg/core/env";

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
