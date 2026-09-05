// Age at which a page hit refetches a clan's roster or event feed in the
// background. Each is judged on its OWN timestamp (`clan_members.refreshed_at`,
// `clans.events_refreshed_at`), never on `clans.last_refreshed_at`, which
// belongs to the full refresh and to the backfill scan that orders by it.
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// Intended coalesce window for page-hit enqueues. NOTHING READS THIS: the
// enqueue path applies no such brake today, so a burst of page hits on one clan
// enqueues it repeatedly (the queue upsert keeps a single row, which is what has
// hidden it). Kept as the documented intent, not as a description of behaviour.
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
