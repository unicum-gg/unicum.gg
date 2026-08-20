import {
  WargamingClient,
  type CacheOptions,
  type EgressConfig,
  type RateLimiterFactory,
  Region,
} from "@unicum.gg/wargaming";
import { Agent, ProxyAgent, type Dispatcher, fetch as undiciFetch } from "undici";
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

// Fraction of each per-egress WG budget carved out for interactive calls; the
// rest goes to the background pipeline. `iv + bg = rps`, so the total rate to WG
// is unchanged (never above the per-IP G-Core budget) — we only split the
// existing budget into lanes, we never add to it.
const INTERACTIVE_RPS_FRACTION = 1 / 3;

// True in the worker (its bootstrap sets `__dbContext = "background"`), false in
// the web (requests stay "request"). Read live, not at setup: it decides which
// lane a call draws from, and it is stable per process in production (the web
// runs no crons: RUN_CRONS=0). Read defensively so this module needs no global
// type wiring.
const isBackground = (): boolean =>
  (globalThis as { __dbContext?: string }).__dbContext === "background";

// The rate-limit key includes the egress IP when multi-egress is on, so each
// source IP keeps its own G-Core per-IP budget (see wargaming DEFAULT_WG_RPS).
//
// Two lanes per egress so the background snapshot pipeline (the heavy, steady
// consumer, in the worker) can never starve interactive calls (search,
// players-online, on-demand player detail, in the web). Both processes share one
// Redis, so a single FIFO token bucket let the pipeline's workers drive it deep
// negative under a backlog, and every interactive call inherited the same wait
// (observed ~43s: search and the online counter timing out). Each lane is its
// own bucket; the pipeline can saturate `bg` without touching `iv`. Portal
// (1 rps/region) is too small to split, so it keeps one shared bucket.
const rateLimit: { factory: RateLimiterFactory } | undefined = redis
  ? {
      factory: ({ region, kind, rps, egress }) => {
        const suffix = egress ? `:${egress}` : "";
        if (rps < 2) {
          return new RedisRateLimiter(
            redis,
            `wg:rl:${kind}:${region}${suffix}`,
            rps,
            rps,
          );
        }
        const ivRps = Math.max(1, Math.round(rps * INTERACTIVE_RPS_FRACTION));
        const bgRps = rps - ivRps;
        const bg = new RedisRateLimiter(
          redis,
          `wg:rl:${kind}:${region}:bg${suffix}`,
          bgRps,
          bgRps,
        );
        const iv = new RedisRateLimiter(
          redis,
          `wg:rl:${kind}:${region}:iv${suffix}`,
          ivRps,
          ivRps,
        );
        return { acquire: () => (isBackground() ? bg : iv).acquire() };
      },
    }
  : undefined;

const parseTargets = (v?: string): string[] | undefined => {
  const t = v?.split(",").map((s) => s.trim()).filter(Boolean);
  return t && t.length > 0 ? t : undefined;
};

// Optional multi-egress: spread WG traffic across our whitelisted source IPs to
// multiply the per-IP G-Core budget (each IP has its own budget; see wargaming
// DEFAULT_WG_RPS). Each WG_EGRESS_* entry is one egress path; the app round-robins
// over them and rate-limits each on its own bucket.
//
// An entry is a `apps/proxy` CONNECT proxy URL (http://<gateway>:<port>) in prod:
// binding a public source IP only works on the host, not inside our bridge
// containers, so the source-IP pinning lives in that proxy and we tunnel through
// it via a ProxyAgent. A bare IP entry is still supported (Agent `localAddress`)
// for host-network / local runs. Unset env => no egress => default behaviour.
const egressTargets: Partial<Record<Region, string[]>> = {
  [Region.EU]: parseTargets(env.WG_EGRESS_EU),
  [Region.NA]: parseTargets(env.WG_EGRESS_NA),
  [Region.ASIA]: parseTargets(env.WG_EGRESS_ASIA),
};
const dispatchers = new Map<string, Dispatcher>();
const egress: EgressConfig | undefined = Object.values(egressTargets).some((v) => v?.length)
  ? {
      ips: egressTargets,
      dispatcherFor: (target) => {
        let dispatcher = dispatchers.get(target);
        if (!dispatcher) {
          dispatcher = /^https?:\/\//.test(target)
            ? new ProxyAgent(target)
            : new Agent({ localAddress: target });
          dispatchers.set(target, dispatcher);
        }
        return dispatcher;
      },
      // Must be undici's own fetch, not Node's global one: the global fetch
      // ignores a dispatcher built by this (separately-installed) undici, so the
      // ProxyAgent/localAddress binding would silently no-op and every request
      // would collapse onto the default egress. Cast because undici's fetch types
      // don't line up exactly with the DOM `fetch` lib type (runtime identical).
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
