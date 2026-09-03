import { TankClient } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { getRedisClient } from "@unicum.gg/core/redis";

/**
 * Short-TTL Redis cache of the fully-serialized tank-detail JSON response.
 *
 * The tank-detail endpoint assembles ~16 sources per call (top players, specs,
 * MoE/MoM + history, research path, modules, the five wot-src fetchers, …) and
 * the page is `force-dynamic`, so every client navigation re-ran the whole
 * assembly — measured at 0.5–2.9s per nav in prod, versus ~50ms for the static
 * pages. Everything in the payload is static between game patches or refreshed
 * by daily crons (top players, MoE), so a plain TTL cache of the serialized
 * payload makes repeat navigations near-instant with no invalidation needed:
 * daily-granularity data is always fresh enough within 30 minutes.
 *
 * We cache the serialized string (not the object) so `Date`s stay ISO strings —
 * revived client-side by the shared response schema — exactly like the API's own
 * `Response.json`, and so a hit skips re-serialization too.
 *
 * The worker's `tank-warm` cron proactively refreshes every tank daily (bust +
 * re-fetch), so entries no longer rely on a visitor to (re)populate them. The
 * TTL is therefore set just above the daily warm interval: long enough that a
 * warmed entry never lapses back to cold between two runs (so navigation stays
 * instant across the whole catalogue), while the daily bust keeps the payload
 * within one day of the source's daily-granularity crons.
 */
export const TANK_DETAIL_TTL_SECONDS = 26 * 60 * 60;

/**
 * Generation of the payload shape, in the key.
 *
 * Entries outlive a deploy by up to 26 hours, so a field added to the payload
 * is a field absent from every warm entry until the TTL turns over: the code
 * expects it, the cache does not have it, and the page crashes on a hit and
 * works on a miss. Bumping this on any change to the assembled shape retires
 * the old generation instead of shipping that window.
 *
 * v2: the community rating headline joined the payload.
 * v3: the client the characteristics were read from, and the test build offered.
 * v4: `isHidden` on the vehicle meta. It also retires the entries written for
 * vehicles that are hidden from now on: the cache answers before the slug is
 * resolved, so without this they would keep serving a page that no longer has
 * a catalogue entry behind it.
 * v5: `variant` on the vehicle meta.
 */
// 6: the top players carry their crests (see `top-player-badges`).
const SHAPE_VERSION = 6;

// The client is part of the key, not a second cache: the same tank on the test
// build is a different payload under the same slug, and the two must never
// answer for each other. Live keeps the bare key it has always had, so the
// entries the warm cron writes are the ones the common path reads.
function key(region: Region, slug: string, client: TankClient): string {
  const suffix = client === TankClient.CommonTest ? `:${TankClient.CommonTest}` : "";
  return `tankdetail:v${SHAPE_VERSION}:${region}:${slug.toLowerCase()}${suffix}`;
}

/** Cached JSON body for this (region, slug), or null on miss / no Redis. */
export async function getCachedTankDetailJson(
  region: Region,
  slug: string,
  client: TankClient = TankClient.Live,
): Promise<string | null> {
  // Dev-only escape hatch for the endpoint speed bench: force a miss so the
  // handler actually assembles the payload (with warm sub-caches), never a hit.
  if (process.env.PERF_BYPASS_PAYLOAD_CACHE === "1") return null;
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return await redis.get(key(region, slug, client));
  } catch {
    return null; // fail open: a Redis blip degrades to "no cache", never an error
  }
}

/** Store the serialized tank-detail JSON. Best-effort. */
export async function setCachedTankDetailJson(
  region: Region,
  slug: string,
  json: string,
  client: TankClient = TankClient.Live,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(key(region, slug, client), json, "EX", TANK_DETAIL_TTL_SECONDS);
  } catch {
    // ignore — caching is best-effort
  }
}
