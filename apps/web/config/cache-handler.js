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

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const v8 = require("node:v8");
const Redis = require("ioredis");
const { PHASE_PRODUCTION_BUILD } = require("next/constants");

// Namespace by the assets this build actually produced.
//
// This used to key off `DEPLOYMENT_ID`, which nothing sets in the deployment, so
// every build collapsed into a single `nover` namespace and the isolation the
// scheme promised never existed. Two ways that bites, both observed:
//   - a fresh deploy serves the previous build's HTML, whose chunk filenames
//     404 against the new assets (dead page, no hydration);
//   - a local `next start` shares the namespace outright. It runs with
//     NODE_ENV=production, and dev's REDIS_URL points at the SHARED prod Redis,
//     so a developer rendering a page on their machine overwrites the
//     production entry with HTML referencing chunks that exist only locally.
// Hashing the build manifest ties the keyspace to the emitted assets instead of
// to a commit (identical sources with uncommitted edits still differ), so
// neither case can reach the other's entries. Stale namespaces age out via TTL.
//
// The fingerprint is the sorted list of emitted chunk filenames, which are
// content-hashed: change a component and the names change with it. It is
// deliberately not `build-manifest.json`, which only lists the framework
// entries and stayed identical across two builds that differed in app code.
//
// No chunk directory means no way to prove which build we are, so Redis stays
// off rather than risk writing into someone else's keyspace: the in-memory tier
// below still serves the instance, bounded.
// `turbopackIgnore` on both filesystem calls: they are resolved at RUNTIME
// against the running container's own output directory, but Turbopack reads
// them statically while tracing, cannot narrow `process.cwd()` or the env var,
// and so pulls the entire project (11k files) into the middleware's file trace.
// Nothing here needs bundling — this module is loaded by `next start` from disk,
// outside the bundle — so telling the tracer to skip it is exactly right.
function buildFingerprint() {
  const dist = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.NEXT_DIST_DIR || ".next",
  );
  try {
    const names = fs
      .readdirSync(/*turbopackIgnore: true*/ path.join(dist, "static", "chunks"))
      .sort();
    if (!names.length) return null;
    return crypto
      .createHash("sha1")
      .update(names.join("\n"))
      .digest("hex")
      .slice(0, 12);
  } catch {
    return null;
  }
}

const DEPLOY = buildFingerprint();
const CACHE_PREFIX = `isr:${DEPLOY}:v:`;
const TAGS_PREFIX = `isr:${DEPLOY}:tag:`;
const LRU_INDEX = `isr:${DEPLOY}:lru`;

// Must stay ABOVE the longest page `revalidate` (currently 24h on the entity
// pages) so the entry survives in Redis for the whole cache window: if it aged
// out first, the next hit would be a full cold regen at the origin even though
// the edge still wants the page. 2 days gives the 24h pages headroom for their
// background revalidation.
const TTL_SECONDS = Number(process.env.NEXT_ISR_CACHE_TTL_SECONDS) || 172_800;
const MAX_REDIS_KEYS = Number(process.env.NEXT_ISR_CACHE_MAX_KEYS) || 10_000;
const TIMEOUT_MS = 1_000;

// Prefer a DEDICATED Redis for the ISR cache, falling back to the shared one.
//
// The shared instance runs `allkeys-lru` at its memory ceiling, mixing this
// cache with the WG response cache, the live pub/sub and sessions. A leaderboard
// page is read from the ORIGIN only when its edge (CF) copy expires — every
// ~30-60 min — while the WG cache is touched every second, so under LRU the
// leaderboard HTML is always the "least recently used" and gets evicted first.
// The next visitor then eats a full synchronous regeneration (2-7s), and with no
// `loading.tsx` the App Router freezes on the previous page until the RSC lands.
//
// On an instance holding ONLY ISR entries, the same leaderboards are among the
// MOST recently accessed (the one-shot entity long tail is older), so they
// survive and the origin serves stale instantly. Point `NEXT_ISR_REDIS_URL` at
// that instance; unset, it degrades to the shared Redis exactly as before.
const ISR_REDIS_URL = process.env.NEXT_ISR_REDIS_URL || process.env.REDIS_URL;

// In-memory hot tier + fallback. Also the sole store in dev / when Redis is
// down. Per-instance; holds the parsed entry objects directly.
//
// BOUNDED IN BYTES, not in entries, and that is the whole reason this block
// looks the way it does. A count cap is what the header above rightly refuses
// for the disk cache, and it had been reintroduced here: 256 entries sounds
// small until the entries are measured. Measured 2026-10-21: the 601 entries in
// the ISR Redis averaged 1870 kB with the heaviest at 8.6 MB, so 256 of them is
// 479 MB of V8 heap per worker at that average and 2.2 GB at the top, times
// three workers. The cluster is sized by memory rather than by cores
// (`ecosystem.config.cjs` divides a budget across the workers and PM2 kills one
// that passes its share), so that is not a cache growing too large, it is the
// cluster dying on a schedule: each of the three workers was killed 82 times in
// 36 hours, two of them within the same minute, which leaves one process
// serving the whole site.
//
// The budget is read from the heap ceiling this worker is actually running
// under rather than written down here, so it follows `WEB_CLUSTER_INSTANCES`
// and `WEB_MEMORY_BUDGET_MB` on its own. A second copy of that arithmetic is
// exactly how `NON_HEAP_MB` came to describe something 500 MB away from what it
// measures.
const LRU_MAX_SIZE = 256;
const HOT_TIER_HEAP_SHARE = 0.1;
const LRU_MAX_BYTES =
  Number(process.env.NEXT_ISR_HOT_TIER_BYTES) ||
  Math.floor(v8.getHeapStatistics().heap_size_limit * HOT_TIER_HEAP_SHARE);
// A page past this is served from Redis and never held in the heap. It bounds
// what ONE entry may take of the budget above, so a single 8.6 MB page cannot
// evict every other page in order to hold itself. What refusing it costs is a
// `v8.deserialize` on each hit instead of a map lookup, which is why it is not
// set lower: the pages that exceed it are the ones whose deserialisation is
// expensive, so excluding more of them spends CPU to save heap.
const MAX_ENTRY_BYTES =
  Number(process.env.NEXT_ISR_MAX_ENTRY_BYTES) || 2_097_152;
// What an entry is charged when its size is not known, which happens only when
// Redis is down or refused it: the exact size is the serialised buffer's length,
// and that buffer exists only because Redis needs it. Charging the measured
// average keeps the bound honest without serialising a second time to weigh it.
const ASSUMED_ENTRY_BYTES = 1_914_880;

// Entries are held as `{ entry, bytes }` so the running total can never drift
// from what the map contains, which a parallel size map would allow.
const lru = (globalThis.__isrLru ||= new Map());
let lruBytes = 0;
for (const held of lru.values()) lruBytes += (held && held.bytes) || 0;

/** Insert into the hot tier, evicting oldest-first until both bounds hold. */
function lruSet(key, entry, bytes) {
  const held = lru.get(key);
  if (held) {
    lru.delete(key);
    lruBytes -= held.bytes;
  }
  // Too big to hold. It stays in Redis, and the copy deleted just above must
  // not come back, so this returns rather than keeping a now-stale entry.
  if (bytes > MAX_ENTRY_BYTES) return;
  lru.set(key, { entry, bytes });
  lruBytes += bytes;
  for (const [k, v] of lru) {
    if (lruBytes <= LRU_MAX_BYTES && lru.size <= LRU_MAX_SIZE) break;
    // Never the entry just written: it is the newest, so evicting it would pay
    // for an eviction and keep nothing.
    if (k === key) continue;
    lru.delete(k);
    lruBytes -= v.bytes;
  }
}

/** The hot-tier entry for a key, or null. */
function lruGet(key) {
  const held = lru.get(key);
  return held ? held.entry : null;
}

// Redis only at runtime in production: never during `next build`
// (PHASE_PRODUCTION_BUILD), and never in dev — dev's Redis URL points at the
// SHARED prod Redis, which a dev run must not write ISR entries into. The
// build fingerprint is the third condition: see `buildFingerprint` above.
let redis = null;
let ready = false;
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD &&
  ISR_REDIS_URL &&
  DEPLOY
) {
  try {
    redis = new Redis(ISR_REDIS_URL, {
      family: 0, // dual-stack DNS (some managed Redis hosts resolve via IPv6)
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      // Reconnect FOREVER (capped backoff), never `null`: returning null makes
      // ioredis give up permanently, so a Redis blip longer than the old ~7.5s
      // window (e.g. the dedicated cache Redis restarting) severed the ISR cache
      // until the next web deploy, silently dropping every page to the in-memory
      // tier. Individual commands still fail-open fast (maxRetriesPerRequest +
      // withTimeout, and every op is gated on `ready`), so retrying the socket
      // forever never blocks a request; it just lets the cache heal on its own.
      retryStrategy: (times) => Math.min(times * 200, 2_000),
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
          // `buf.length` is what the entry costs, already in hand here, so the
          // hot tier is weighed without serialising anything a second time.
          lruSet(key, entry, buf.length);
          return entry;
        }
      } catch {
        // fall through to the in-memory tier
      }
    }
    return lruGet(key);
  }

  async set(key, data, ctx) {
    const tags = (ctx && ctx.tags) || [];
    const entry = { value: data, lastModified: Date.now(), tags };

    // Serialised BEFORE the hot tier sees it, because the buffer Redis needs is
    // also the only exact measure of what the entry costs, and the hot tier is
    // bounded in bytes. Weighing it any other way would mean serialising twice
    // or reading Next's internal payload shape, which moves between versions.
    let buf = null;
    if (redis && ready) {
      try {
        buf = v8.serialize(entry);
      } catch {
        // Unserialisable: it cannot go to Redis. It is still held in the hot
        // tier, charged at the assumed size, as it was before this bound.
      }
    }
    lruSet(key, entry, buf ? buf.length : ASSUMED_ENTRY_BYTES);
    if (!buf) return; // no Redis, or unserialisable: the hot tier has it
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
    for (const [key, held] of lru) {
      const { entry, bytes } = held;
      if (entry.tags && entry.tags.some((t) => list.includes(t))) {
        lru.delete(key);
        lruBytes -= bytes;
      }
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
