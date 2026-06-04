import { Region } from ".";

/**
 * Token bucket — refills at `refillPerSec`, caps at `capacity`.
 * `acquire()` either returns immediately if a token is available, or
 * queues the caller until one is. FIFO order.
 */
class RateLimiter {
  private tokens: number;
  private lastRefill = Date.now();
  private queue: Array<() => void> = [];
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
  }

  acquire(): Promise<void> {
    this.refill();
    // Fast path: token available and no one ahead in queue
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
      const resolve = this.queue.shift();
      if (resolve) resolve();
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

// WG public API server-side limit = 20 RPS per application_id, BUT that's
// never our actual ceiling: DNS for `api.worldoftanks.*` is geo-routed, and
// from any VPS (Contabo, OVH, Hetzner) we resolve to G-Core IPs (92.223.x.x),
// NOT Wargaming's `*.fe.core.pw` origin. So all 3 API hosts sit behind the
// same G-Core WAF as the portals.
//
// Empirical confirmation: 18 RPS sustained on api.worldoftanks.eu from OVH
// gave 71.3% success / p50 3.5s latency (10-min test, 2026-06-03), exactly
// the same throttle signature as the portals.
//
// Same +1/day ramp discipline as PORTAL_RPS — start at 1 RPS per region,
// bump each day until that host starts timing out.
const WG_RPS: Record<Region, number> = {
  [Region.EU]: 1,
  [Region.NA]: 1,
  [Region.ASIA]: 1,
};
const WG_BURST: Record<Region, number> = {
  [Region.EU]: 1,
  [Region.NA]: 1,
  [Region.ASIA]: 1,
};

const wgLimiters: Record<Region, RateLimiter> = {
  [Region.EU]: new RateLimiter(WG_BURST[Region.EU], WG_RPS[Region.EU]),
  [Region.NA]: new RateLimiter(WG_BURST[Region.NA], WG_RPS[Region.NA]),
  [Region.ASIA]: new RateLimiter(WG_BURST[Region.ASIA], WG_RPS[Region.ASIA]),
};

export function acquireWgToken(region: Region): Promise<void> {
  return wgLimiters[region].acquire();
}

// ─── PORTAL RATE LIMIT (the one that actually gets us banned) ───────────────
//
// `*.wargaming.net/clans/*` is fronted by G-Core CDN which has an aggressive
// anti-scraping WAF: once an IP crosses some unpublished volume threshold
// (likely ~minutes of sustained > a few RPS), TCP packets to 92.223.x.x get
// silently dropped for ~2h. We've been bitten on Contabo (persistent) and
// reproduced on OVH (cleared after ~2h post-stress-test).
//
// Empirical safe ceiling from `negri/wotclans` (a C# scraper that's been
// running in prod for years without bans):
//   `WebFetchInterval = TimeSpan.FromSeconds(1)` → ~1 RPS sustained MAX.
//
// PER-REGION token bucket because empirically the 3 hosts behave very
// differently: EU portal was getting silently dropped from Contabo while
// NA/ASIA portals were still reachable. The threshold (and ban state) is
// tracked separately per `<region>.wargaming.net` endpoint. We start
// uniformly at 1 RPS each and bump per region until one of them starts
// timing out — that tells us the ceiling on THAT host for our IP/AS.
const PORTAL_RPS: Record<Region, number> = {
  [Region.EU]: 1,
  [Region.NA]: 1,
  [Region.ASIA]: 1,
};
const PORTAL_BURST: Record<Region, number> = {
  [Region.EU]: 1,
  [Region.NA]: 1,
  [Region.ASIA]: 1,
};

const portalLimiters: Record<Region, RateLimiter> = {
  [Region.EU]: new RateLimiter(PORTAL_BURST[Region.EU], PORTAL_RPS[Region.EU]),
  [Region.NA]: new RateLimiter(PORTAL_BURST[Region.NA], PORTAL_RPS[Region.NA]),
  [Region.ASIA]: new RateLimiter(PORTAL_BURST[Region.ASIA], PORTAL_RPS[Region.ASIA]),
};

export function acquirePortalToken(region: Region): Promise<void> {
  return portalLimiters[region].acquire();
}
