// Custom Next.js ISR cache handler — wired in via `next.config.ts` (`cacheHandler`).
//
// WHY THIS EXISTS
// The player and clan pages are `force-static` + `revalidate` with on-demand
// generation over ~2M+ entities. Next's DEFAULT server cache writes every
// generated page to the container's local disk (`.next/server/app/...`) with
// **no eviction**, so it grows without bound and eventually fills the disk —
// which once took the production DB down (postgres could no longer write) and
// even truncated root's authorized_keys. Per the Next.js self-hosting guide
// ("Caching and ISR"), the fix is a custom cacheHandler backed by durable
// storage with an eviction policy. We back it with the Redis we already run.
//
// EVICTION (two bounds, belt-and-suspenders)
//  - A per-entry TTL (`TTL_SECONDS`) ages out the long tail. It is kept well
//    above the pages' `revalidate` (1800s) on purpose, so stale-while-revalidate
//    still has an entry to serve while a fresh one regenerates.
//  - A hard key-count cap (`MAX_REDIS_KEYS`) with an LRU index (a sorted set
//    scored by access time) evicts the oldest keys, so the handler bounds Redis
//    itself instead of relying solely on a `maxmemory` policy. A Redis
//    `maxmemory` + `allkeys-lru` is still worth setting as an ultimate backstop.
//
// RUNTIME NOTE
// This runs in the raw Node runtime of `next start`, OUTSIDE the transpiled app
// bundle, so it is plain CommonJS and imports nothing from the TS workspace
// packages. Entries are stored with `v8.serialize` so cache payloads (which
// contain Buffers, e.g. the RSC stream) round-trip losslessly — plain JSON
// would turn a Buffer into `{type:"Buffer",...}` and corrupt the page.

const v8 = require("node:v8");
const Redis = require("ioredis");
const { PHASE_PRODUCTION_BUILD } = require("next/constants");

// Namespace by deployment so a new build never serves a previous build's
// prerendered HTML; stale-deploy keys just age out via their TTL.
const DEPLOY = process.env.DEPLOYMENT_ID || "nover";
const CACHE_PREFIX = `isr:${DEPLOY}:v:`;
const TAGS_PREFIX = `isr:${DEPLOY}:tag:`;
const LRU_INDEX = `isr:${DEPLOY}:lru`;

const TTL_SECONDS = Number(process.env.NEXT_ISR_CACHE_TTL_SECONDS) || 7_200;
const MAX_REDIS_KEYS = Number(process.env.NEXT_ISR_CACHE_MAX_KEYS) || 10_000;
const TIMEOUT_MS = 1_000;

// In-memory hot tier + fallback. Also the sole store in dev / when Redis is
// down. Small, per-instance; holds the parsed entry objects directly.
const LRU_MAX_SIZE = 256;
const lru = (globalThis.__isrLru ||= new Map());
function lruSet(key, entry) {
  if (lru.has(key)) lru.delete(key);
  else if (lru.size >= LRU_MAX_SIZE) lru.delete(lru.keys().next().value);
  lru.set(key, entry);
}

// Redis only at runtime in production: never during `next build`
// (PHASE_PRODUCTION_BUILD), and never in dev — dev's `REDIS_URL` points at the
// SHARED prod Redis, which a dev run must not write ISR entries into.
let redis = null;
let ready = false;
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD &&
  process.env.REDIS_URL
) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      family: 0, // dual-stack DNS (some managed Redis hosts resolve via IPv6)
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 5_000)),
    });
    redis.on("ready", () => {
      ready = true;
    });
    for (const ev of ["error", "close", "reconnecting", "end"]) {
      redis.on(ev, () => {
        ready = false;
      });
    }
    redis.connect().catch((err) =>
      console.warn("[isr-cache] redis connect failed:", err && err.message),
    );
  } catch (err) {
    console.warn("[isr-cache] redis init failed:", err && err.message);
    redis = null;
  }
}

// Bound every Redis op so a slow-but-connected server can never stall a request.
function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("redis timeout")), TIMEOUT_MS),
    ),
  ]);
}

// Trim the oldest keys once the cap is exceeded (access-time ordered LRU).
async function evictIfNeeded() {
  if (!redis || !ready) return;
  try {
    const count = await redis.zcard(LRU_INDEX);
    if (count <= MAX_REDIS_KEYS) return;
    const oldest = await redis.zrange(LRU_INDEX, 0, count - MAX_REDIS_KEYS - 1);
    if (!oldest.length) return;
    const pipe = redis.pipeline();
    for (const k of oldest) pipe.del(CACHE_PREFIX + k);
    pipe.zrem(LRU_INDEX, ...oldest);
    await pipe.exec();
  } catch {
    // eviction is best-effort
  }
}

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options;
  }

  async get(key) {
    if (redis && ready) {
      try {
        const buf = await withTimeout(redis.getBuffer(CACHE_PREFIX + key));
        if (buf) {
          const entry = v8.deserialize(buf);
          // bump access time for LRU, populate the hot tier
          redis.zadd(LRU_INDEX, Date.now(), key).catch(() => {});
          lruSet(key, entry);
          return entry;
        }
      } catch {
        // fall through to the in-memory tier
      }
    }
    return lru.get(key) || null;
  }

  async set(key, data, ctx) {
    const tags = (ctx && ctx.tags) || [];
    const entry = { value: data, lastModified: Date.now(), tags };
    lruSet(key, entry);
    if (!redis || !ready) return;

    let buf;
    try {
      buf = v8.serialize(entry);
    } catch {
      return; // unserialisable entry → skip caching rather than throw
    }
    try {
      const pipe = redis.pipeline();
      pipe.set(CACHE_PREFIX + key, buf, "EX", TTL_SECONDS);
      pipe.zadd(LRU_INDEX, Date.now(), key);
      pipe.expire(LRU_INDEX, TTL_SECONDS); // don't let the index outlive its entries
      for (const tag of tags) {
        pipe.sadd(TAGS_PREFIX + tag, key);
        pipe.expire(TAGS_PREFIX + tag, TTL_SECONDS);
      }
      await withTimeout(pipe.exec());
      evictIfNeeded(); // async, non-blocking
    } catch {
      // best-effort write; the in-memory tier still holds the entry
    }
  }

  async revalidateTag(tags) {
    const list = Array.isArray(tags) ? tags : [tags];
    for (const [key, entry] of lru) {
      if (entry.tags && entry.tags.some((t) => list.includes(t))) lru.delete(key);
    }
    if (!redis || !ready) return;
    try {
      for (const tag of list) {
        const keys = await withTimeout(redis.smembers(TAGS_PREFIX + tag));
        if (!keys.length) continue;
        const pipe = redis.pipeline();
        for (const k of keys) {
          pipe.del(CACHE_PREFIX + k);
          pipe.zrem(LRU_INDEX, k);
        }
        pipe.del(TAGS_PREFIX + tag);
        await withTimeout(pipe.exec());
      }
    } catch {
      // best-effort invalidation
    }
  }

  resetRequestCache() {}
};
