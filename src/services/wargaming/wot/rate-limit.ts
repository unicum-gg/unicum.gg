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
// from any VPS (OVH, Hetzner, etc.) we resolve to G-Core IPs (92.223.x.x),
// NOT Wargaming's `*.fe.core.pw` origin. So all 3 API hosts sit behind the
// same G-Core WAF as the portals.
//
// On OVH (clean IP, no DNS pinning) 5 RPS sustained is fine empirically —
// snapshot-cron (200 calls/min) + clan-backfill (20/min) + user-driven
// ClanPage loads (~200 calls per page) saturate the queue at 1 RPS but drain
// cleanly at 5. Still well under G-Core's WAF threshold (we stress-tested
// 18-60 RPS before getting throttled).
//
// ASIA also at 5: the region has lots of deleted/banned accounts, and
// fetchTanksStatsChunk recursively bisects on INVALID_ACCOUNT_ID to isolate
// the bad one. A single tick with high deleted-density can spawn 500-1500
// wgFetch calls, which at 1 RPS = 8-25 min per tick (the cron runs every
// minute → infinite pileup). At 5 RPS we drain in <60s. Asia API tested
// clean from OVH (1s latency direct).
// EU dropped from 5 to 3 after sustained G-Core block (60+ /wot/tanks/stats/
// timeouts at 30s exact), see the cluster pattern documented in PORTAL_RPS
// below. EU's threshold sits lower than NA/ASIA in our experience.
// Daily +1 RPS exploration to find the new ceiling empirically. Watch logs
// for the 30s-exact timeout cluster (G-Core WAF signature) and revert if it
// shows. EU 4→5 after 32h at 4 with zero snapshot-cron timeouts. NA/ASIA
// bumped 6→8 — both have shown more headroom than EU in prior tests.
const WG_RPS: Record<Region, number> = {
  [Region.EU]: 6,
  [Region.NA]: 8,
  [Region.ASIA]: 8,
};
const WG_BURST: Record<Region, number> = {
  [Region.EU]: 6,
  [Region.NA]: 8,
  [Region.ASIA]: 8,
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
// silently dropped for ~2h. Reproduced empirically: the ban clears on its
// own after roughly two hours post-stress-test.
//
// Empirical safe ceiling from `negri/wotclans` (a C# scraper that's been
// running in prod for years without bans):
//   `WebFetchInterval = TimeSpan.FromSeconds(1)` → ~1 RPS sustained MAX.
//
// PER-REGION token bucket because empirically the 3 hosts behave very
// differently: we've observed EU portal getting silently dropped while
// NA/ASIA portals stayed reachable. The threshold (and ban state) is
// tracked separately per `<region>.wargaming.net` endpoint.
//
// Bumped 1 → 10 on 2026-06-21 based on a local-IP stress test. That test
// was misleading: from the OVH VPS IP the EU G-Core silently banned within
// the hour (10k+ portal connect timeouts against 92.223.23.118/23 — the
// documented WAF signature). Reverting all three back to 1 RPS sustained.
// The negri/wotclans empirical ceiling stands: 1 RPS is what runs long-term
// without bans. Do not re-bump without validating from the actual prod IP
// for at least 30 min sustained.
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
