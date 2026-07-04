import {
  WargamingClient,
  type CacheOptions,
  type RateLimiterFactory,
} from "@unicum.gg/wargaming";
import { Region } from "@unicum.gg/wargaming/region";
import { env } from "env";
import { botHeaders } from "@/lib/bot-headers";
import { traced } from "@/lib/perf-trace";
import { getRedisClient } from "@/services/redis";
import { RedisCacheStore } from "./redis-cache";
import { RedisRateLimiter } from "./redis-rate-limiter";

// With Redis configured, the SDK's cache + rate-limit budget is shared across
// every web replica and the worker (one WG budget, one cache). Without it
// (local dev), the SDK falls back to per-process in-memory behaviour.
const redis = getRedisClient();
const cache: CacheOptions | undefined = redis ? { store: new RedisCacheStore(redis) } : undefined;
const rateLimit: { factory: RateLimiterFactory } | undefined = redis
  ? {
      factory: ({ region, kind, rps }) =>
        new RedisRateLimiter(redis, `wg:rl:${kind}:${region}`, rps, rps),
    }
  : undefined;

/**
 * The single Wargaming client for this app — configured with our WG
 * application ids, our identified-bot User-Agent, and our perf tracing.
 * Navigate `wg.<region>.<surface>.<resource>.<method>(...)`, e.g.
 * `wg.eu.api.wot.accounts.info({ accountId })` or `wg.region(region).portal.clans.members({ clanId })`.
 */
export const wg = new WargamingClient({
  applicationId: {
    [Region.EU]: env.WARGAMING_APPLICATION_ID_EU,
    [Region.NA]: env.WARGAMING_APPLICATION_ID_NA,
    [Region.ASIA]: env.WARGAMING_APPLICATION_ID_ASIA,
  },
  headers: botHeaders,
  trace: traced,
  cache,
  rateLimit,
});
