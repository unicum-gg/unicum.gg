import type { Region } from "@unicum.gg/wargaming";

/**
 * A per-region, process-lifetime cache with in-flight dedup.
 *
 * The shape the catalogue loaders keep needing: a table that is static between
 * cron refreshes, read on hot paths, and cheap to hold whole. A plain Map
 * rather than `unstable_cache`, so cron-driven callers without an
 * IncrementalCache context do not throw.
 *
 * Invalidation is generation-counted rather than a bare `delete`. A refresh
 * that lands while a read is in flight would otherwise be undone by it: the
 * in-flight query read the pre-refresh rows, and its `.then` would write them
 * back with a full TTL, serving stale thresholds for hours. A load whose
 * generation no longer matches resolves normally for its own caller but does
 * not populate the cache.
 */
export type RegionCache<T> = {
  get(region: Region): Promise<T>;
  invalidate(region: Region): void;
};

export function createRegionCache<T>(
  load: (region: Region) => Promise<T>,
  ttlMs: number,
): RegionCache<T> {
  const cache = new Map<Region, { data: T; expiresAt: number }>();
  const inFlight = new Map<Region, Promise<T>>();
  const generation = new Map<Region, number>();

  return {
    get(region: Region): Promise<T> {
      const hit = cache.get(region);
      if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data);
      const pending = inFlight.get(region);
      if (pending) return pending;

      const startedAt = generation.get(region) ?? 0;
      const promise = load(region)
        .then((data) => {
          // Dropped if the rows were refreshed while this query was running.
          if ((generation.get(region) ?? 0) === startedAt) {
            cache.set(region, { data, expiresAt: Date.now() + ttlMs });
          }
          return data;
        })
        .finally(() => {
          inFlight.delete(region);
        });
      inFlight.set(region, promise);
      return promise;
    },

    invalidate(region: Region): void {
      cache.delete(region);
      generation.set(region, (generation.get(region) ?? 0) + 1);
    },
  };
}
