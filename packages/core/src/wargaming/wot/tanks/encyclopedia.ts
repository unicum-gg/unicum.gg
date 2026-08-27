import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { type NewVehicle, vehiclesByRegion, type VehicleMeta } from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import {
  catalogueNaming,
  fetchCommonTestVehicles,
  fetchVehicleCatalog,
} from "@unicum.gg/core/wargaming/wot/tanks/wotsrc";

// Module-level in-memory cache. Lives for the lifetime of the Node process
// (cleared on deploy/restart) and is shared across all callers — both inside
// a request lifecycle and inside cron ticks. We deliberately avoid
// `unstable_cache` here because it requires an IncrementalCache context that
// cron-driven calls (snapshot-cron → updatePlayerRatings) don't have, and
// Next throws `Invariant: incrementalCache missing in unstable_cache`. The
// underlying DB read is <50ms anyway, so a plain Map gives us all the
// per-process dedup we need.
// The stored icon URLs are legacy WG CDN links served over plain http. Upgrade
// them to https on read so they aren't blocked as mixed content on our https
// pages (and so the OG image / schema.org markup carry a secure URL).
function httpsUrl(url: string | null): string | null {
  return url ? url.replace(/^http:\/\//, "https://") : url;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new Map<
  Region,
  { data: Record<string, VehicleMeta>; expiresAt: number }
>();
const inFlight = new Map<Region, Promise<Record<string, VehicleMeta>>>();

async function loadVehicles(
  region: Region,
): Promise<Record<string, VehicleMeta>> {
  const table = vehiclesByRegion[region];
  const rows = await db
    .select({
      tankId: table.tankId,
      tier: table.tier,
      type: table.type,
      nation: table.nation,
      name: table.name,
      shortName: table.shortName,
      tag: table.tag,
      isPremium: table.isPremium,
      isReward: table.isReward,
      isCommonTest: table.isCommonTest,
      isHidden: table.isHidden,
      variant: table.variant,
      role: table.role,
      contourIcon: table.contourIcon,
      bigIcon: table.bigIcon,
    })
    .from(table);
  if (rows.length === 0) {
    await refreshVehicles(region);
    return loadVehicles(region);
  }
  const out: Record<string, VehicleMeta> = {};
  for (const r of rows) {
    out[String(r.tankId)] = {
      tier: r.tier,
      type: r.type,
      nation: r.nation,
      name: r.name,
      // The wot-src mirror omits `shortName` when it equals the full name (the
      // famous tanks: IS-7, T-34, Type 59, ...), leaving ~216 rows blank. Fall
      // back to `name` so the slug, search, and every "on the {shortName}"
      // label stay populated instead of collapsing to the bare tank id.
      shortName: r.shortName || r.name,
      tag: r.tag,
      isPremium: r.isPremium,
      isReward: r.isReward,
      isCommonTest: r.isCommonTest,
      isHidden: r.isHidden,
      variant: r.variant,
      role: r.role,
      contourIcon: httpsUrl(r.contourIcon),
      bigIcon: httpsUrl(r.bigIcon),
    };
  }
  return out;
}

/**
 * Reads the per-region catalogue from the DB and shapes it into the
 * `Record<tank_id, VehicleMeta>` consumers expect. On a cold table the read
 * auto-bootstraps via `refreshVehicles` (one fetch from the wot-src GitHub
 * mirror, ~3-5s once) and subsequent calls are <50ms. The weekly discovery
 * cron keeps the table fresh; concurrent callers share the in-flight promise
 * to dedup the DB round-trip.
 */
export async function getVehicleEncyclopedia(
  region: Region,
): Promise<Record<string, VehicleMeta>> {
  const cached = cache.get(region);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const pending = inFlight.get(region);
  if (pending) return pending;
  const promise = loadVehicles(region)
    .then((data) => {
      cache.set(region, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    })
    .finally(() => {
      inFlight.delete(region);
    });
  inFlight.set(region, promise);
  return promise;
}

/**
 * Fetch the full vehicle catalogue from the IzeBerg/wot-src GitHub mirror
 * and upsert into `<region>_vehicles`. Called by the weekly cron (for all
 * regions) and as the cold-start bootstrap inside `loadVehicles`. The
 * mirror tracks the live WoT game client, so this returns ~1224 tanks
 * including the ~224 that WG's public API has stripped (removed/event-only
 * tanks that still show up in player stats).
 */
export async function refreshVehicles(region: Region): Promise<number> {
  const table = vehiclesByRegion[region];
  const [catalog, commonTest] = await Promise.all([
    fetchVehicleCatalog(region),
    fetchCommonTestVehicles(region),
  ]);
  // Test vehicles join the same catalogue rather than a table of their own:
  // everything downstream (slugs, detail, search) then works on them for free,
  // and the flag is what the few places that must exclude them read.
  const rows: NewVehicle[] = [...catalog, ...commonTest.values()].map((v) => ({
    tankId: v.tankId,
    tier: v.tier,
    type: v.type,
    nation: v.nation,
    ...catalogueNaming(v),
    tag: v.tag,
    isPremium: v.isPremium,
    isWheeled: v.isWheeled,
    isGift: v.isGift,
    isReward: v.isReward,
    role: v.role,
    isCommonTest: commonTest.has(v.tankId),
    smallIcon: null,
    contourIcon: null,
    bigIcon: null,
    updatedAt: new Date(),
  }));
  if (rows.length === 0) return 0;
  await db
    .insert(table)
    .values(rows)
    // Refresh existing rows with the incoming catalogue values. `excluded` is
    // the row that would have been inserted; referencing `table.<col>` here
    // would instead keep the stale value (a self-assignment no-op).
    .onConflictDoUpdate({
      target: table.tankId,
      set: {
        tier: sql`excluded.tier`,
        type: sql`excluded.type`,
        nation: sql`excluded.nation`,
        // Both carry the variant suffix `catalogueNaming` adds, so a vehicle
        // that changes catalogue file is renamed here rather than keeping the
        // name it was first written with.
        name: sql`excluded.name`,
        shortName: sql`excluded.short_name`,
        tag: sql`excluded.tag`,
        isPremium: sql`excluded.is_premium`,
        isWheeled: sql`excluded.is_wheeled`,
        isGift: sql`excluded.is_gift`,
        isReward: sql`excluded.is_reward`,
        role: sql`excluded.role`,
        // A vehicle leaves the test build by shipping, so this must be able to
        // go back to false, not just be set once.
        isCommonTest: sql`excluded.is_common_test`,
        // A vehicle can stop being hidden the same way: the client moves its
        // name into the nation catalogue and it becomes an ownable tank.
        isHidden: sql`excluded.is_hidden`,
        variant: sql`excluded.variant`,
        updatedAt: new Date(),
      },
    });
  return rows.length;
}
