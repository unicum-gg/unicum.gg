/** A cached response with its absolute expiry (UNIX ms). */
export type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

/**
 * Pluggable cache backend. The default is an in-memory LRU store, but any
 * async store (e.g. Redis) can be supplied via `cache.store`.
 */
export type CacheStore = {
  get(key: string): Promise<CacheEntry<unknown> | null>;
  set(key: string, entry: CacheEntry<unknown>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
  keys(): Promise<string[]>;
};
