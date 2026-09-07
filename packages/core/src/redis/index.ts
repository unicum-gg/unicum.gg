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

/** Whether this process is `next build` rather than the running app. Next sets
 * `NEXT_PHASE` itself; compared as a string so core keeps no `next` dependency
 * (`next/constants` exports the same value). */
function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

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

  // `REDIS_BUILD_URL` is an escape hatch for a build that cannot reach Redis at
  // the address the running app uses, and it should stay UNSET.
  //
  // It was added when BuildKit gave every build step its own network sandbox,
  // where the service's Docker hostname did not resolve ("Name does not
  // resolve" from an isolated network, while the published endpoint answered),
  // and it held the published address instead. Pointing the build at Redis by
  // IP is what makes it rot: the address moved with the host on 2026-08-30 and
  // the variable did not, so from then on the build spent every page timing out
  // against a decommissioned box. That is not cosmetic. Without Redis the WG
  // rate limiter has no bucket at all (the in-memory one is only installed when
  // `REDIS_URL` is unset), so the build logs `[wg rate-limit] Redis
  // unavailable, proceeding unthrottled` and its parallel workers hit
  // Wargaming with nothing holding them back, which is how G-Core bans us.
  //
  // The sandbox is gone: buildkitd runs with Docker's embedded DNS
  // (`[dns] nameservers = ["127.0.0.11"]`), so a service hostname resolves
  // while building exactly as it does at runtime, which is how `DATABASE_URL`
  // and `NEXT_ISR_REDIS_URL` already reach their containers by name during
  // prerendering. So the build reads `REDIS_URL` like everything else, and an
  // override that names one address twice would only be waiting to disagree.
  const url =
    (isProductionBuild() ? env.REDIS_BUILD_URL : undefined) ?? env.REDIS_URL;
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
  // A function when the result decides its own lifetime: a fetch that fell open
  // on an empty value is worth keeping for minutes, a real one for hours.
  ttlSeconds: number | ((value: T) => number),
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
    const ttl =
      typeof ttlSeconds === "function" ? ttlSeconds(value) : ttlSeconds;
    await redis.set(key, JSON.stringify(value), "EX", ttl);
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
