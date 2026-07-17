import { Region } from "../region";

/** A rate limiter: `acquire()` resolves once this call may proceed. */
export type WgRateLimiter = {
  acquire(): Promise<void>;
};

/** Which limiter pool a request uses, or `None` to skip rate limiting. */
export enum RateLimit {
  Wg = "wg",
  Portal = "portal",
  None = "none",
}

/** The pools a limiter can be built for: every `RateLimit` except `None`. */
export type RateLimiterKind = Exclude<RateLimit, RateLimit.None>;

/**
 * Builds a limiter for a given region/pool. Supply one via
 * `rateLimit.factory` to share the budget across processes (e.g. Redis) instead
 * of the default per-process in-memory buckets.
 */
export type RateLimiterFactory = (ctx: {
  region: Region;
  kind: RateLimiterKind;
  rps: number;
  /**
   * When set, this limiter serves one specific egress source IP, so a
   * distributed (e.g. Redis) key must include it: each IP has its own G-Core
   * per-IP budget, and lumping them under one key would defeat multi-egress.
   */
  egress?: string;
}) => WgRateLimiter;

/**
 * Token bucket — refills at `refillPerSec`, caps at `capacity`. `acquire()`
 * returns immediately if a token is available, else queues (FIFO) until one is.
 */
export class RateLimiter implements WgRateLimiter {
  private tokens: number;
  private lastRefill = Date.now();
  private queue: Array<() => void> = [];
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
  }

  acquire(): Promise<void> {
    this.refill();
    if (this.queue.length === 0 && this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.startInterval();
    });
  }

  private startInterval(): void {
    if (this.interval) return;
    const intervalMs = Math.max(1, Math.ceil(1000 / this.refillPerSec));
    this.interval = setInterval(() => this.tick(), intervalMs);
  }

  private tick(): void {
    this.refill();
    while (this.tokens >= 1 && this.queue.length > 0) {
      this.tokens -= 1;
      this.queue.shift()?.();
    }
    if (this.queue.length === 0 && this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed > 0) {
      this.tokens = Math.min(
        this.capacity,
        this.tokens + elapsed * this.refillPerSec,
      );
      this.lastRefill = now;
    }
  }
}

export type RegionRps = Record<Region, number>;

// Per-region sustainable RPS, found empirically. api.worldoftanks.* and the
// clan portals are geo-routed to G-Core CDN edges (*.fe.core.pw) from most VPS
// hosts; G-Core's WAF rate-limits well below WG's own ~20 RPS per-application
// ceiling.
//
// G-Core WAF mechanism (docs.gcore.com/waap/waap-rules/advanced-rules/advanced-rate-limiting-rules):
// a fixed-window counter, PER CLIENT IP by default ("each request is counted
// individually per IP"), that blocks the IP for a configurable duration once a
// threshold is crossed. WG's exact threshold + ban length are unpublished, so
// these numbers are empirical; a trip shows up as request TIMEOUTS (not 429),
// and WG's ban runs ~2h (see DEFAULT_PORTAL_RPS). Aggressive short retries make
// it kick in harder, so back off long (transport.ts RETRY_DELAYS_MS).
//
// The counter being per-IP is the key lever: two whitelisted egress IPs measured
// ~2x the throughput (each gets its own budget). So raise throughput by adding
// whitelisted source IPs, NOT by bumping these values — a higher *sustained*
// per-IP rate just earns the per-IP ban (a short burst won't show it).
// Overridable via client options.
export const DEFAULT_WG_RPS: RegionRps = {
  [Region.EU]: 6,
  [Region.NA]: 8,
  [Region.ASIA]: 8,
};

// Portal WAF is stricter: ~1 RPS sustained is negri/wotclans's long-running
// empirical ceiling, and crossing the (unpublished) volume threshold bans the
// IP for ~2h. Same per-IP, block-for-duration model as DEFAULT_WG_RPS above.
export const DEFAULT_PORTAL_RPS: RegionRps = {
  [Region.EU]: 1,
  [Region.NA]: 1,
  [Region.ASIA]: 1,
};

/**
 * One limiter per region, keyed off the given RPS map (burst = rps). Uses
 * `factory` when provided (shared/distributed limiter), else in-memory buckets.
 */
export function regionLimiters(
  rps: RegionRps,
  kind: RateLimiterKind,
  factory?: RateLimiterFactory,
): Record<Region, WgRateLimiter> {
  const make = (region: Region): WgRateLimiter =>
    factory ? factory({ region, kind, rps: rps[region] }) : new RateLimiter(rps[region], rps[region]);
  return {
    [Region.EU]: make(Region.EU),
    [Region.NA]: make(Region.NA),
    [Region.ASIA]: make(Region.ASIA),
  };
}

/**
 * Spread WG traffic across several source IPs to multiply the per-IP G-Core
 * budget (see DEFAULT_WG_RPS): each IP has its own rate-limiter bucket, and the
 * socket is bound to it via `dispatcherFor`. Kept fully injectable so this
 * package stays runtime-neutral (the app supplies the IP list + a dispatcher
 * factory + the matching fetch, e.g. an undici Agent bound via `localAddress`
 * plus undici's own `fetch`).
 */
export type EgressConfig = {
  /** Source IPs per region. Each must be a local address on the host AND
   * whitelisted on that region's WG application, else calls fail. */
  ips?: Partial<Record<Region, string[]>>;
  /** Builds a fetch `dispatcher` bound to one source IP. Typed `unknown` to
   * avoid depending on undici here; passed straight to `fetchImpl`. */
  dispatcherFor: (ip: string) => unknown;
  /**
   * The fetch implementation paired with `dispatcherFor`. Required for the
   * source-IP binding to actually take effect: Node's global fetch silently
   * IGNORES a `dispatcher` created by a separately-installed undici (instance
   * mismatch), so the app must pass undici's own `fetch` here so the two match.
   * Defaults to global fetch (fine only when no dispatcher is used).
   */
  fetchImpl?: typeof fetch;
};

/** One egress path for a region: a rate-limiter bucket plus an optional
 * source-IP dispatcher. A region with no egress config has a single lane with
 * no dispatcher, i.e. the default single-IP behavior. */
export type Lane = { limiter: WgRateLimiter; dispatcher?: unknown };

/**
 * Per region, the egress lanes to round-robin over: one lane per configured
 * source IP (each with its own IP-keyed limiter), or a single default lane when
 * no egress is set for that region.
 */
export function regionLanes(
  rps: RegionRps,
  kind: RateLimiterKind,
  factory?: RateLimiterFactory,
  egress?: EgressConfig,
): Record<Region, Lane[]> {
  const bucket = (region: Region, ip?: string): WgRateLimiter =>
    factory
      ? factory({ region, kind, rps: rps[region], egress: ip })
      : new RateLimiter(rps[region], rps[region]);
  const make = (region: Region): Lane[] => {
    const ips = egress?.ips?.[region]?.filter(Boolean);
    if (ips && ips.length > 0) {
      return ips.map((ip) => ({
        limiter: bucket(region, ip),
        dispatcher: egress!.dispatcherFor(ip),
      }));
    }
    return [{ limiter: bucket(region) }];
  };
  return {
    [Region.EU]: make(Region.EU),
    [Region.NA]: make(Region.NA),
    [Region.ASIA]: make(Region.ASIA),
  };
}
