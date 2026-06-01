export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function isStale(at: Date | null): boolean {
  if (!at) return true;
  return Date.now() - at.getTime() > STALE_AFTER_MS;
}

const inflight = new Map<string, Promise<unknown>>();

export function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
