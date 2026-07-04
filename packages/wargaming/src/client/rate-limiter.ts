import { Region } from "../region";

/** A rate limiter: `acquire()` resolves once this call may proceed. */
export type WgRateLimiter = {
  acquire(): Promise<void>;
};

/** Which limiter pool a request belongs to. */
export type RateLimiterKind = "wg" | "portal";

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

// Defaults tuned empirically against G-Core (api.worldoftanks.* and the clan
// portals are geo-routed to G-Core CDN IPs from most VPS hosts, whose WAF
// throttles well below WG's official 20 RPS). Overridable via client options.
export const DEFAULT_WG_RPS: RegionRps = {
  [Region.EU]: 6,
  [Region.NA]: 8,
  [Region.ASIA]: 8,
};

// The portal WAF bans an IP for ~2h past an unpublished volume threshold;
// negri/wotclans's long-running empirical ceiling is ~1 RPS sustained.
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
