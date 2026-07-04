// Stale threshold for the backfill cron: clans older than this are picked
// up by the 24h scan. Page hits use COALESCE_AFTER_MS instead.
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// Coalesce window for page-hit enqueues. A clan refreshed less than this
// ago does not get re-enqueued — avoids hammering the queue on burst traffic.
export const COALESCE_AFTER_MS = 5 * 60 * 1000;

export function isStale(at: Date | null): boolean {
  if (!at) return true;
  return Date.now() - at.getTime() > STALE_AFTER_MS;
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * In-process call dedup for fire-and-forget background refreshes triggered
 * from page hits (members/events). Page-hit clan-info refreshes go through
 * the refresh-queue instead and don't need this.
 */
export function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
