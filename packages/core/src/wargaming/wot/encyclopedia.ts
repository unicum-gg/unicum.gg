import { db } from "@unicum.gg/core/db";
import { type NewVehicle, vehiclesByRegion } from "@unicum.gg/core/db/schema";
import { Region } from "@unicum.gg/wargaming/region";
import { fetchVehicleCatalog } from "@unicum.gg/core/wargaming/wot/wotsrc";
import type { VehicleMeta } from "./vehicle-meta";

// Module-level in-memory cache. Lives for the lifetime of the Node process
// (cleared on deploy/restart) and is shared across all callers — both inside
// a request lifecycle and inside cron ticks. We deliberately avoid
// `unstable_cache` here because it requires an IncrementalCache context that
// cron-driven calls (snapshot-cron → updatePlayerRatings) don't have, and
// Next throws `Invariant: incrementalCache missing in unstable_cache`. The
// underlying DB read is <50ms anyway, so a plain Map gives us all the
// per-process dedup we need.
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
      contourIcon: table.contourIcon,
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
      shortName: r.shortName,
      tag: r.tag,
      isPremium: r.isPremium,
      contourIcon: r.contourIcon,
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
  const catalog = await fetchVehicleCatalog(region);
  const rows: NewVehicle[] = catalog.map((v) => ({
    tankId: v.tankId,
    tier: v.tier,
    type: v.type,
    nation: v.nation,
    name: v.name,
    shortName: v.shortName,
    tag: v.tag,
    isPremium: v.isPremium,
    isWheeled: v.isWheeled,
    isGift: v.isGift,
    smallIcon: null,
    contourIcon: null,
    bigIcon: null,
    updatedAt: new Date(),
  }));
  if (rows.length === 0) return 0;
  await db
    .insert(table)
    .values(rows)
    .onConflictDoUpdate({
      target: table.tankId,
      set: {
        tier: table.tier,
        type: table.type,
        nation: table.nation,
        name: table.name,
        shortName: table.shortName,
        tag: table.tag,
        isPremium: table.isPremium,
        isWheeled: table.isWheeled,
        isGift: table.isGift,
        updatedAt: new Date(),
      },
    });
  return rows.length;
}
