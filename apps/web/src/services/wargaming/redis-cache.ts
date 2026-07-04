import type Redis from "ioredis";
import type { CacheEntry, CacheStore } from "@unicum.gg/wargaming";

const PREFIX = "wg:cache:";

/**
 * Redis-backed {@link CacheStore} for the WG SDK, so the static-endpoint cache
 * is shared across web replicas and the worker. Entries carry their own expiry;
 * we also set a native Redis PX so Redis evicts them without our help.
 */
export class RedisCacheStore implements CacheStore {
  constructor(private readonly redis: Redis) {}

  // All methods fail open: a Redis error is treated as a cache miss / no-op so
  // a blip degrades to "no cache", never to a stalled or failed WG call.
  async get(key: string): Promise<CacheEntry<unknown> | null> {
    try {
      const raw = await this.redis.get(PREFIX + key);
      return raw ? (JSON.parse(raw) as CacheEntry<unknown>) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, entry: CacheEntry<unknown>): Promise<void> {
    const px = entry.expiresAt - Date.now();
    if (px <= 0) return;
    try {
      await this.redis.set(PREFIX + key, JSON.stringify(entry), "PX", px);
    } catch {
      // ignore — caching is best-effort
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(PREFIX + key);
  }

  async clear(): Promise<void> {
    for await (const keys of this.#scan()) {
      if (keys.length) await this.redis.del(...keys);
    }
  }

  async size(): Promise<number> {
    let count = 0;
    for await (const keys of this.#scan()) count += keys.length;
    return count;
  }

  async keys(): Promise<string[]> {
    const out: string[] = [];
    for await (const keys of this.#scan()) {
      for (const k of keys) out.push(k.slice(PREFIX.length));
    }
    return out;
  }

  async *#scan(): AsyncGenerator<string[]> {
    let cursor = "0";
    do {
      const [next, keys] = await this.redis.scan(cursor, "MATCH", `${PREFIX}*`, "COUNT", 200);
      cursor = next;
      yield keys;
    } while (cursor !== "0");
  }
}
