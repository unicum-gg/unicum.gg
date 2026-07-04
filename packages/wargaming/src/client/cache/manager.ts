import { MemoryCacheStore } from "./memory";
import type { CacheStore } from "./store";

/** Per-client cache options. Caching is on by default for a small allowlist of
 * static endpoints (see the transport); volatile endpoints are never cached. */
export type CacheOptions = {
  /** Master switch. Defaults to `true`. Set `false` to disable all caching. */
  enabled?: boolean;
  /** Max entries kept by the default in-memory store. Defaults to 1000. */
  maxSize?: number;
  /** A custom (e.g. Redis-backed) store. Defaults to an in-memory LRU store. */
  store?: CacheStore;
};

/**
 * Wraps a `CacheStore` with expiry handling and read-through/write helpers.
 * Entries carry their own absolute expiry, so different endpoints can use
 * different TTLs against a single store.
 */
export class CacheManager {
  readonly #store: CacheStore;

  constructor(options: { store?: CacheStore; maxSize?: number } = {}) {
    this.#store = options.store ?? new MemoryCacheStore(options.maxSize ?? 1000);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = await this.#store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      await this.#store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    await this.#store.set(key, { data, expiresAt: Date.now() + ttl });
  }

  clear(): Promise<void> {
    return this.#store.clear();
  }

  async stats(): Promise<{ size: number; keys: string[] }> {
    return { size: await this.#store.size(), keys: await this.#store.keys() };
  }
}
