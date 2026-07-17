import {
  WargamingClient,
  type CacheOptions,
  type EgressConfig,
  type RateLimiterFactory,
  Region,
} from "@unicum.gg/wargaming";
import { Agent, fetch as undiciFetch } from "undici";
import { env, botHeaders } from "@unicum.gg/shared";
import { traced } from "@unicum.gg/core/lib/perf-trace";
import { getRedisClient } from "@unicum.gg/core/redis";
import { RedisCacheStore } from "./redis-cache";
import { RedisRateLimiter } from "./redis-rate-limiter";

// With Redis configured, the SDK's cache + rate-limit budget is shared across
// every web replica and the worker (one WG budget, one cache). Without it
// (local dev), the SDK falls back to per-process in-memory behaviour.
const redis = getRedisClient();
const cache: CacheOptions | undefined = redis ? { store: new RedisCacheStore(redis) } : undefined;

// The rate-limit key includes the egress IP when multi-egress is on, so each
// source IP keeps its own G-Core per-IP budget (see wargaming DEFAULT_WG_RPS).
const rateLimit: { factory: RateLimiterFactory } | undefined = redis
  ? {
      factory: ({ region, kind, rps, egress }) =>
        new RedisRateLimiter(
          redis,
          `wg:rl:${kind}:${region}${egress ? `:${egress}` : ""}`,
          rps,
          rps,
        ),
    }
  : undefined;

const parseIps = (v?: string): string[] | undefined => {
  const ips = v?.split(",").map((s) => s.trim()).filter(Boolean);
  return ips && ips.length > 0 ? ips : undefined;
};

// Optional multi-egress: spread WG traffic across whitelisted source IPs to
// multiply the per-IP G-Core budget. Bind each to its socket via an undici
// Agent's top-level `localAddress` (one Agent per IP, reused across requests).
// NB: `localAddress` is a Client option, NOT `connect.localAddress` (the latter
// is clobbered by undici's per-connect arg and silently no-ops). Unset env =>
// no egress => the SDK's default single-IP behaviour.
const egressIps: Partial<Record<Region, string[]>> = {
  [Region.EU]: parseIps(env.WG_EGRESS_EU),
  [Region.NA]: parseIps(env.WG_EGRESS_NA),
  [Region.ASIA]: parseIps(env.WG_EGRESS_ASIA),
};
const agents = new Map<string, Agent>();
const egress: EgressConfig | undefined = Object.values(egressIps).some((v) => v?.length)
  ? {
      ips: egressIps,
      dispatcherFor: (ip) => {
        let agent = agents.get(ip);
        if (!agent) {
          agent = new Agent({ localAddress: ip });
          agents.set(ip, agent);
        }
        return agent;
      },
      // Must be undici's own fetch, not Node's global one: the global fetch
      // ignores a dispatcher built by this (separately-installed) undici, so the
      // localAddress bind would silently no-op and every IP would collapse onto
      // the default egress. Cast because undici's fetch types don't line up
      // exactly with the DOM `fetch` lib type (runtime behaviour is identical).
      fetchImpl: undiciFetch as unknown as typeof fetch,
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
  egress,
});
