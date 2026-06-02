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

// WG server-side limit is 20 RPS per application_id. We keep a 2 RPS margin.
const WG_RPS_PER_REGION = 18;
const WG_BURST_PER_REGION = 20;

const wgLimiters: Record<Region, RateLimiter> = {
  [Region.EU]: new RateLimiter(WG_BURST_PER_REGION, WG_RPS_PER_REGION),
  [Region.NA]: new RateLimiter(WG_BURST_PER_REGION, WG_RPS_PER_REGION),
  [Region.ASIA]: new RateLimiter(WG_BURST_PER_REGION, WG_RPS_PER_REGION),
};

export function acquireWgToken(region: Region): Promise<void> {
  return wgLimiters[region].acquire();
}

/**
 * Bounded counter — caps in-flight calls at `max`. Extra callers queue FIFO.
 */
class Semaphore {
  private inFlight = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  acquire(): Promise<void> {
    if (this.inFlight < this.max) {
      this.inFlight += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.inFlight += 1;
        resolve();
      });
    });
  }

  release(): void {
    this.inFlight -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

// Per-region wgFetch concurrency cap. All regions currently unbounded —
// the 18 RPS token bucket already protects us against WG's 20 RPS per-app
// limit, and api.worldoftanks.* tolerates parallel connections fine. Keep
// the Semaphore wiring so we can dial a region down quickly if needed.
const wgConcurrency: Record<Region, Semaphore> = {
  [Region.EU]: new Semaphore(Number.POSITIVE_INFINITY),
  [Region.NA]: new Semaphore(Number.POSITIVE_INFINITY),
  [Region.ASIA]: new Semaphore(Number.POSITIVE_INFINITY),
};

export function acquireWgSlot(region: Region): Promise<void> {
  return wgConcurrency[region].acquire();
}

export function releaseWgSlot(region: Region): void {
  wgConcurrency[region].release();
}

// *.wargaming.net (used by portalFetch for clan history, members, events)
// refuses concurrent connections under load: parallel calls all time out
// while a steady serial stream succeeds. Same symptom as Asia api but on a
// different host. Cap parallelism per region for portal calls too.
const portalConcurrency: Record<Region, Semaphore> = {
  [Region.EU]: new Semaphore(3),
  [Region.NA]: new Semaphore(3),
  [Region.ASIA]: new Semaphore(3),
};

export function acquirePortalSlot(region: Region): Promise<void> {
  return portalConcurrency[region].acquire();
}

export function releasePortalSlot(region: Region): void {
  portalConcurrency[region].release();
}
