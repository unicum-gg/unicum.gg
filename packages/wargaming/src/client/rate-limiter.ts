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
