import {
  RateLimit,
  WargamingClient,
  type CacheOptions,
  type EgressConfig,
  type RateLimiterFactory,
  type RateLimiterKind,
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

// Per-egress budget reserved for interactive calls; the background pipeline gets
// the rest (`bg = rps - iv`), so `iv + bg = rps` and the total rate to WG is
// unchanged (never above the per-IP G-Core budget), we only split the existing
// budget into lanes, we never add to it. A fixed reserve rather than a fraction
// of `rps`: `rps` is the region's G-Core per-IP ceiling, not its interactive
// demand, so a fraction would over-reserve the higher-ceiling regions (NA/Asia
// at 8 rps have less traffic than EU at 6). A constant lane keeps interactive
// responsive everywhere while `bg` grows with the region's ceiling (EU 4, NA/Asia
// 6). Clamped so `bg` keeps at least 1.
const INTERACTIVE_RESERVE_RPS = 2;

// True in the worker (its bootstrap sets `__dbContext = "background"`), false in
// the web (requests stay "request"). Read live, not at setup: it decides which
// lane a call draws from, and it is stable per process in production (the web
// runs no crons: RUN_CRONS=0). Read defensively so this module needs no global
// type wiring.
const isBackground = (): boolean =>
  (globalThis as { __dbContext?: string }).__dbContext === "background";

// The pools split into two lanes per egress, so the background snapshot pipeline
// (the heavy, steady consumer, in the worker) can never starve interactive calls
// (search, players-online, on-demand player detail, in the web). Both processes
// share one Redis, so a single FIFO token bucket let the pipeline's workers drive
// it deep negative under a backlog and every interactive call inherited the same
// wait (observed ~43s: search and the online counter timing out). Each lane is
// its own bucket; the pipeline can saturate `bg` without touching `iv`.
//
// Only the public API pool qualifies, because it is the only one a user request
// can actually land on. The portal pool is 1 rps, too small to divide. The
// stronghold pool has no interactive consumer at all, both its callers are
// worker crons, so it always draws from the background lane, and splitting it
// would idle 40% of the budget (5 rps advertised, 3 usable) against a lane
// nothing ever queues on.
const SPLIT_POOLS: ReadonlySet<RateLimiterKind> = new Set([RateLimit.Wg]);

const rateLimit: { factory: RateLimiterFactory } | undefined = redis
  ? {
      // The rate-limit key includes the egress IP when multi-egress is on, so
      // each source IP keeps its own G-Core per-IP budget (see DEFAULT_WG_RPS).
      factory: ({ region, kind, rps, egress }) => {
        const suffix = egress ? `:${egress}` : "";
        const ivRps = Math.min(INTERACTIVE_RESERVE_RPS, rps - 1);
        if (!SPLIT_POOLS.has(kind) || ivRps < 1) {
          return new RedisRateLimiter(
            redis,
            `wg:rl:${kind}:${region}${suffix}`,
            rps,
            rps,
          );
        }
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
 * The single Wargaming client for this app, configured with our WG
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
