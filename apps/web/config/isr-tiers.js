// What the ISR store KEEPS and what it drops, which is a policy rather than a
// cache: `cache-handler.js` owns reading and writing an entry, this owns which
// entries are allowed to survive each other.
//
// Its own file because the handler was already at the length this project keeps
// a file to before any of this existed, and because the two concerns genuinely
// part here: nothing below reads or writes a page, it only decides what leaves.

// The page addresses that are fixed once a region is chosen, generated from the
// route tree by `scripts/generate-page-routes.ts` so this file carries no list
// of its own. A pattern here is a whole path: `[language]` and `page/[n]`
// variants are deliberately absent, since six `lang` patterns across 36
// languages, 36 locales and 3 regions is 23,000 pages, which is larger than the
// store and would put this tier back in the position it exists to escape.
let SECTION_PATTERNS = new Set();
try {
  SECTION_PATTERNS = new Set(require("./isr-section-routes.generated.json"));
} catch {
  // Absent only if the generator has not run. Everything then lands in the long
  // tail, which is exactly how the store behaved before this split, so it
  // degrades rather than throwing at boot.
}

const REGIONS = new Set(["eu", "na", "asia"]);

/**
 * Whether a cache key is one of the pages a reader NAVIGATES BETWEEN.
 *
 * The key is Next's own, `/route-cache/APP_PAGE/<hash>/$/<locale>/<path>`, so
 * the page's address is what follows `/$/` once the locale and an optional
 * region segment are removed. Both are stripped because a section is the same
 * section in every language and on every server: `/fr/eu/players/onslaught` and
 * `/de/players/onslaught` are two entries of one bounded page, and the tier is
 * about the SHAPE of an address rather than about how many copies of it exist.
 *
 * Anything with no `/$/` at all is not a page (Next caches fetches and route
 * handlers under the same prefix), so it takes its chances with the long tail.
 */
function isSectionKey(key) {
  const at = key.lastIndexOf("/$/");
  if (at < 0) return false;
  const segments = key.slice(at + 3).split("/");
  // The locale, which every PAGE carries. A root-level file route carries none
  // (`/$/icon.svg`), and dropping its only segment would leave the empty path,
  // which is the home page: a locale has no dot in it, so that is what tells
  // the two apart.
  if (segments[0].includes(".")) return false;
  segments.shift();
  if (REGIONS.has(segments[0])) segments.shift();
  const path = segments.length ? `/${segments.join("/")}` : "/";
  return SECTION_PATTERNS.has(path);
}

/**
 * Trim one tier to its byte budget, oldest access first.
 *
 * Summed from the size hash rather than from a running counter, because a
 * counter and the store drift apart the moment an entry leaves by TTL rather
 * than by eviction, and a drifting counter either trims a healthy cache or lets
 * Redis reach its ceiling, which is the failure this whole split exists to
 * prevent. One `hmget` over a tier's members is a single round trip, and this
 * runs on a write (a page regeneration), never on a read.
 *
 * A member whose size is missing has expired underneath the index, so it is
 * dropped from the index too: left there it would be weighed at zero forever
 * and slowly make the budget meaningless.
 */
async function trimTier(redis, { prefix, sizes, maxKeys }, index, budget) {
  const members = await redis.zrange(index, 0, -1);
  if (!members.length) return;
  // Oldest first, so anything past the member cap goes before the pass below
  // even weighs what remains.
  const overflow = members.length - maxKeys;
  const capped = overflow > 0 ? members.slice(0, overflow) : [];
  const kept = overflow > 0 ? members.slice(overflow) : members;
  const measured = await redis.hmget(sizes, ...kept);
  let total = 0;
  const stale = [...capped];
  const weighed = [];
  for (const [i, member] of kept.entries()) {
    const bytes = Number(measured[i]);
    if (!Number.isFinite(bytes) || bytes <= 0) {
      stale.push(member);
      continue;
    }
    total += bytes;
    weighed.push([member, bytes]);
  }
  const drop = [...stale];
  // `weighed` is in the index's own order, which is oldest access first.
  for (const [member, bytes] of weighed) {
    if (total <= budget) break;
    drop.push(member);
    total -= bytes;
  }
  if (!drop.length) return;
  const pipe = redis.pipeline();
  for (const key of drop) pipe.del(prefix + key);
  pipe.zrem(index, ...drop);
  pipe.hdel(sizes, ...drop);
  await pipe.exec();
}

/**
 * Drop every namespace that is not this build's.
 *
 * A namespace is a build fingerprint, so each deploy starts an empty keyspace
 * beside the previous one and the old entries sit there until their 48h TTL
 * expires. That TTL cannot be shortened: it has to outlive the longest page
 * `revalidate`, which is 24h. So with the handful of deploys a busy day sees,
 * the store permanently carries several dead builds.
 *
 * Measured 2026-11-18 on the live store: SIX namespaces, 3,021 entries, of
 * which 1,501 belonged to the running build. Half of a 4 GiB instance was cache
 * for code that no longer exists, held under the same ceiling as the live
 * entries, so it was pushing them out.
 *
 * The cost is one brief cold window per deploy. A rolling update keeps the
 * previous containers serving for a few seconds, and this deletes entries they
 * are still reading, so they re-render until they are replaced. That is bounded
 * and happens once; losing half the cache is neither. The caller delays the
 * sweep past that drain for the same reason, and `unlink` frees the keys on
 * Redis's own thread so a large sweep never blocks a read.
 */
async function sweepStaleNamespaces(redis, deploy, batch = 500) {
  const mine = `isr:${deploy}:`;
  let cursor = "0";
  let dropped = 0;
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      "isr:*",
      "COUNT",
      batch,
    );
    cursor = next;
    const stale = keys.filter((key) => !key.startsWith(mine));
    if (stale.length) {
      await redis.unlink(...stale);
      dropped += stale.length;
    }
  } while (cursor !== "0");
  return dropped;
}

module.exports = { isSectionKey, trimTier, sweepStaleNamespaces };
