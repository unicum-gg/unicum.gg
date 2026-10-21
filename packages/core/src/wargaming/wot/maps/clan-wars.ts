import type { Region } from "@unicum.gg/wargaming";
import { cachedInRedis } from "@unicum.gg/core/redis";
import { withDeadline } from "@unicum.gg/core/lib/deadline";
import { wg } from "../../client";

// The Clan Wars map pool is the set of arenas the current Global Map season is
// fought on. It is not in the static client scripts (it is set server-side per
// season), so we derive it live: every active Front's provinces carry the
// `arena_id` they are played on, and the distinct set across all provinces is
// the pool. It changes only when a season starts/ends, so a coarse per-region
// memo keeps the catalogue routes off the network.
//
// Two tiers, because this is by far the most expensive WG call the maps section
// makes (a fronts call, then up to 20 pages of provinces per active front, per
// region). The in-process memo below keeps a warm process off Redis entirely;
// Redis keeps the whole fleet off Wargaming. Without the second tier every
// process paid the walk on its own: `next build` runs 7 workers, so a build
// made it seven times over and regularly timed out on `globalmap/provinces`.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// An empty result (a WG failure fell open, or a genuine off-season with no active
// Front) is cached only briefly, so a transient blip can't hide the Clan Wars
// pool for the full window. A real, non-empty pool is cached for the long TTL.
const EMPTY_CACHE_TTL_MS = 5 * 60 * 1000;
// A Front has a few hundred provinces (WG caps a page at 100); this bounds the
// walk well above any real Front so a misbehaving API can't loop forever.
const PROVINCES_PAGE_SIZE = 100;
const MAX_PROVINCE_PAGES = 20;
// How long a reader may wait on the pool before being served without the tag.
//
// It exists for the state Wargaming left EU in on 2026-10-20, which is the
// shape to recognise rather than this one endpoint. `globalmap/fronts` answered
// `504 SOURCE_NOT_AVAILABLE` in 0.11s while NA and Asia were fine. The
// transport rightly treats that code as retriable (it is usually a blip, and a
// cron SHOULD keep trying), so it spent its whole budget on it: five retries at
// 2/8/18/32/50s is 110s, and the measured span was 112.5s of a 112.7s request.
// A pool that only decorates a map card with a battle-type tag must never be
// able to do that to a reader, however long WG stays down.
//
// Sized just above a healthy walk, measured in production rather than from a
// shell: NA is 3.6s (781ms of `fronts`, then three province pages at 597/912/
// 1297ms, sequential), Asia 6.4s end to end. The same walk from an unthrottled
// host is 2.0s, so the rate limiter and the egress lanes are most of it, and
// measuring without them would have set this far too low.
//
// Being a little over it is cheap by design: `getClanWarsArenaIds` bounds the
// wait without abandoning the walk, so a slower-than-expected region still
// caches its real pool for six hours and only the reader who happened to arrive
// first goes without the tag.
const WALK_DEADLINE_MS = 8_000;

const cache = new Map<Region, { value: Set<string>; expiresAt: number }>();
const inflight = new Map<Region, Promise<Set<string>>>();

async function frontArenaIds(region: Region, frontId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= MAX_PROVINCE_PAGES; page++) {
    const provinces = await wg
      .region(region)
      .api.wot.globalMap.provinces({
        frontId,
        fields: ["arena_id"],
        limit: PROVINCES_PAGE_SIZE,
        pageNo: page,
      });
    for (const p of provinces) if (p.arena_id) ids.push(p.arena_id);
    if (provinces.length < PROVINCES_PAGE_SIZE) break;
  }
  return ids;
}

async function walkClanWarsArenaIds(region: Region): Promise<string[]> {
  const fronts = await wg
    .region(region)
    .api.wot.globalMap.fronts({ fields: ["front_id", "is_active"] });
  const active = fronts.filter((f) => f.is_active).map((f) => f.front_id);
  const perFront = await Promise.all(
    active.map((frontId) => frontArenaIds(region, frontId)),
  );
  return [...new Set(perFront.flat())];
}

/** The walk, fail-open, shared across every process through Redis. Unbounded on
 * purpose: the caller bounds its own wait, see `getClanWarsArenaIds`.
 * An array rather than a Set because the cache round-trips through JSON.
 *
 * The fail-open belongs INSIDE the cached compute, and that is the whole repair.
 * It used to sit a layer above, in `getClanWarsArenaIds`, so a failed walk threw
 * rather than returning a value: `cachedInRedis` only writes what `compute`
 * RESOLVES to, so nothing was ever cached and the empty-result TTL this file
 * already defines could not apply to the one case it was written for. Each
 * worker then fell back to its own 5-minute memo and re-walked on its own, which
 * is exactly what production showed during the outage above, `:na` and `:asia`
 * holding their pools while `wg:clan-wars-pool:eu` was simply absent. Failing
 * open here turns a failure into the empty array `EMPTY_CACHE_TTL_MS` was always
 * meant to cover, so the fleet shares one short negative window instead of one
 * per worker. */
function fetchClanWarsArenaIds(region: Region): Promise<Set<string>> {
  return cachedInRedis(
    `wg:clan-wars-pool:${region}`,
    (ids: string[]) =>
      (ids.length > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS) / 1000,
    async () => {
      try {
        return await walkClanWarsArenaIds(region);
      } catch {
        return [];
      }
    },
  ).then((ids) => new Set(ids));
}

/** Refresh the pool in the background, one walk per region at a time.
 *
 * It fills the memo on its own rather than through its caller, so a reader that
 * stopped waiting (or never waited at all, see below) still leaves the next one
 * a warm value. */
function refreshClanWarsArenaIds(region: Region): Promise<Set<string>> {
  const held = inflight.get(region);
  if (held) return held;

  const promise = fetchClanWarsArenaIds(region)
    .catch(() => new Set<string>())
    .then((value) => {
      const ttl = value.size > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
      cache.set(region, { value, expiresAt: Date.now() + ttl });
      return value;
    })
    .finally(() => {
      inflight.delete(region);
    });

  inflight.set(region, promise);
  return promise;
}

/** The arena ids in the current Global Map (Clan Wars) map pool for a region.
 * Cached, bounded and fail-open: a WG failure, an off-season with no active
 * Front, or a first walk still running at `WALK_DEADLINE_MS` all answer with an
 * empty set, so the maps catalogue always renders, just without the Clan Wars
 * tag, and never later than the deadline.
 *
 * An EXPIRED value is served as it stands while the refresh runs behind it,
 * which is what keeps the deadline off the hot path. Awaiting the refresh
 * instead left `/api/eu/maps` answering in 8.2s, measured on five consecutive
 * probes on 2026-10-21 against 2.5s for NA and 0.06s for Asia, and the reason
 * is that both expiries land together: the memo's empty window and the Redis
 * key's are the same `EMPTY_CACHE_TTL_MS`, written at the same instant by the
 * same walk. So the memo never expires onto a Redis hit, it expires onto a
 * miss, and the walk that follows takes 110s for as long as Wargaming EU
 * answers `504 SOURCE_NOT_AVAILABLE` (the transport rightly retries that code).
 * Every reader arriving inside those 110s paid the full deadline, about a
 * quarter of them. Shortening the memo would not have moved it, since the walk
 * is relaunched by the Redis expiry rather than by the memo's.
 *
 * Serving the stale value costs nothing it was not already costing: what is
 * held during a Wargaming outage is the empty set the deadline would have
 * answered with anyway, and what is held during a slow walk is the real pool,
 * which is strictly better than the empty one. It also means a region whose
 * season genuinely ended keeps answering instantly instead of re-walking.
 *
 * The `catch` inside the refresh is the net under the cache layer itself (an
 * unreachable Redis), since the walk's own failures are absorbed one level
 * down, where they can be cached. */
export async function getClanWarsArenaIds(region: Region): Promise<Set<string>> {
  const held = cache.get(region);
  if (held && held.expiresAt > Date.now()) return held.value;

  const promise = refreshClanWarsArenaIds(region);
  if (held) {
    // Detached on purpose: the refresh writes the memo itself, and nothing here
    // is waiting for it. It never rejects, so there is no unhandled rejection
    // to answer for.
    void promise;
    return held.value;
  }

  // Only a cold region reaches the deadline, and it bounds the WAIT rather than
  // the walk, which is the whole reason it can be this short. The walk keeps
  // running, still writes Redis for six hours and still fills the memo, so a
  // healthy region whose first walk is simply slower than the deadline loses
  // its Clan Wars tag for one reader rather than for a cache window. Racing it
  // inside the cached compute instead would have DISCARDED that walk's result
  // and cached the empty set for five minutes, so a region taking longer than
  // the deadline would have lost the tag repeatedly, forever, which is a worse
  // bug than the one being fixed.
  return (await withDeadline(promise, WALK_DEADLINE_MS)) ?? new Set();
}
