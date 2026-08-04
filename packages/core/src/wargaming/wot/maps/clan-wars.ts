import type { Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

// The Clan Wars map pool is the set of arenas the current Global Map season is
// fought on. It is not in the static client scripts (it is set server-side per
// season), so we derive it live: every active Front's provinces carry the
// `arena_id` they are played on, and the distinct set across all provinces is
// the pool. It changes only when a season starts/ends, so a coarse per-region
// memo keeps the catalogue routes off the network.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// An empty result (a WG failure fell open, or a genuine off-season with no active
// Front) is cached only briefly, so a transient blip can't hide the Clan Wars
// pool for the full window. A real, non-empty pool is cached for the long TTL.
const EMPTY_CACHE_TTL_MS = 5 * 60 * 1000;
// A Front has a few hundred provinces (WG caps a page at 100); this bounds the
// walk well above any real Front so a misbehaving API can't loop forever.
const PROVINCES_PAGE_SIZE = 100;
const MAX_PROVINCE_PAGES = 20;

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

async function fetchClanWarsArenaIds(region: Region): Promise<Set<string>> {
  const fronts = await wg
    .region(region)
    .api.wot.globalMap.fronts({ fields: ["front_id", "is_active"] });
  const active = fronts.filter((f) => f.is_active).map((f) => f.front_id);
  const perFront = await Promise.all(
    active.map((frontId) => frontArenaIds(region, frontId)),
  );
  return new Set(perFront.flat());
}

/** The arena ids in the current Global Map (Clan Wars) map pool for a region.
 * Cached, and fail-open: any WG failure (or an off-season with no active Front)
 * resolves to an empty set, so the maps catalogue always renders, just without
 * the Clan Wars tag. */
export async function getClanWarsArenaIds(region: Region): Promise<Set<string>> {
  const cached = cache.get(region);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const existing = inflight.get(region);
  if (existing) return existing;

  const promise = fetchClanWarsArenaIds(region)
    .catch(() => new Set<string>())
    .then((value) => {
      const ttl = value.size > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
      cache.set(region, { value, expiresAt: Date.now() + ttl });
      inflight.delete(region);
      return value;
    });
  inflight.set(region, promise);
  return promise;
}
