import { getRedisClient } from "@unicum.gg/core/redis";

/**
 * How many people followed a creator's vanity link, counted per day.
 *
 * It exists because a partnership is currently renewed on a feeling. The link
 * carries UTM parameters, which is the right thing for a web analytics tool to
 * read, and reading them has never once happened: the quota of the one we run
 * is spent, its figures are skewed by the scrapes we have taken, and the other
 * is behind a consent banner most readers never answer. So the one number every
 * partnership rests on is the one number nobody has. A counter at the redirect
 * cannot be skewed by any of that, because it counts the single event the whole
 * arrangement is about: somebody typed the creator's URL.
 *
 * It is deliberately not analytics. There is no visitor here, no session and no
 * identity, only a tally per slug and per day. That is what makes it something
 * we can keep without asking anybody's permission for it, and it is also all
 * the question needs: at the end of the month, did this cost more than it
 * brought.
 *
 * Redis rather than a table, for the reason the ISR cache is in Redis: the
 * write sits on the hot path of a redirect that has to leave immediately, and
 * `INCR` is one round trip with no transaction, no migration and no connection
 * taken from the pool. What that costs is durability, and the trade is
 * acceptable here and nowhere near a ledger: this instance runs `allkeys-lru`
 * at a 2 GiB ceiling, so a counter CAN be evicted, and losing a day of a tally
 * loses an estimate rather than a record. If these numbers ever decide money
 * rather than inform it, they belong in Postgres.
 */

const PREFIX = "partner:hits";

/**
 * How long a day's tally is kept, a little over a year.
 *
 * Long enough that a creator we worked with last autumn can still be compared
 * against one we are talking to now, which is exactly the comparison that sets
 * a price, and short enough that the keys cannot accumulate forever in a store
 * that is mostly cache.
 */
const RETENTION_SECONDS = 400 * 24 * 60 * 60;

/** The UTC day a hit is credited to. UTC rather than Europe/Paris because a
 * creator's audience is wherever it is, and a boundary that moves twice a year
 * would put two different lengths of day in the same series. */
function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function key(slug: string, day: string): string {
  return `${PREFIX}:${slug}:${day}`;
}

/**
 * Count one arrival on a creator's vanity URL.
 *
 * Fire-and-forget and fail-open, which is the whole contract: the caller is a
 * redirect that a person is waiting on, so this must never delay it and must
 * never be able to fail it. A Redis blip costs a click off a tally, which is
 * the cheapest thing in the entire path.
 */
export function recordPartnerHit(slug: string): void {
  const redis = getRedisClient();
  if (!redis) return;
  const k = key(slug, dayOf(new Date()));
  void redis
    .multi()
    .incr(k)
    .expire(k, RETENTION_SECONDS)
    .exec()
    .catch(() => {});
}

export type PartnerHitDay = { slug: string; day: string; hits: number };

/**
 * Read the daily tallies of the given slugs over the last `days` days, today
 * included, oldest first.
 *
 * The keys are built rather than scanned. `SCAN` over this instance would walk
 * a store whose other tenants are the ISR cache and the Wargaming payloads,
 * which is hundreds of thousands of keys to find a few dozen, and both the
 * slugs and the days are already known to the caller.
 */
export async function readPartnerHits(
  slugs: string[],
  days: number,
): Promise<PartnerHitDay[]> {
  const redis = getRedisClient();
  if (!redis || slugs.length === 0 || days <= 0) return [];
  const now = Date.now();
  const window = Array.from({ length: days }, (_, i) =>
    dayOf(new Date(now - (days - 1 - i) * 864e5)),
  );
  const pairs = slugs.flatMap((slug) => window.map((day) => ({ slug, day })));
  const values = await redis.mget(pairs.map((p) => key(p.slug, p.day)));
  return pairs.map((p, i) => ({ ...p, hits: Number(values[i] ?? 0) }));
}
