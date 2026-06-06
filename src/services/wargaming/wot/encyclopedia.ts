import { unstable_cache } from "next/cache";
import { db } from "@/services/db";
import { type NewVehicle, vehiclesByRegion } from "@/services/db/schema";
import { Region } from ".";
import { wgFetch } from "./fetch";
import type { TankStats } from "./tanks";

export type VehicleMeta = { tier: number; type: string };

type WGVehicleRaw = {
  tank_id: number;
  tier: number;
  type: string;
  nation: string;
  name: string;
  short_name: string;
  tag: string;
  is_premium: boolean;
  is_wheeled: boolean;
  is_gift: boolean;
  images: {
    small_icon?: string | null;
    contour_icon?: string | null;
    big_icon?: string | null;
  } | null;
};

const VEHICLE_FIELDS = [
  "tank_id",
  "tier",
  "type",
  "nation",
  "name",
  "short_name",
  "tag",
  "is_premium",
  "is_wheeled",
  "is_gift",
  "images",
].join(",");

/**
 * Reads the per-region catalogue from the DB and shapes it into the
 * `Record<tank_id, VehicleMeta>` consumers expect. On a cold table the read
 * auto-bootstraps via `refreshVehiclesFromWG` (one wgFetch, ~5s once) and
 * subsequent calls are <50ms. The weekly discovery cron keeps the table
 * fresh; the Next-level cache below keeps the per-request cost zero after
 * the first hit.
 */
async function loadVehiclesUncached(
  region: Region,
): Promise<Record<string, VehicleMeta>> {
  const table = vehiclesByRegion[region];
  const rows = await db
    .select({ tankId: table.tankId, tier: table.tier, type: table.type })
    .from(table);
  if (rows.length === 0) {
    await refreshVehiclesFromWG(region);
    return loadVehiclesUncached(region);
  }
  const out: Record<string, VehicleMeta> = {};
  for (const r of rows) out[String(r.tankId)] = { tier: r.tier, type: r.type };
  return out;
}

const loadVehiclesCached = unstable_cache(
  async (region: Region) => loadVehiclesUncached(region),
  ["vehicle-encyclopedia-db"],
  { revalidate: 7 * 24 * 60 * 60, tags: ["encyclopedia"] },
);

export async function getVehicleEncyclopedia(
  region: Region,
): Promise<Record<string, VehicleMeta>> {
  return loadVehiclesCached(region);
}

/**
 * Fetch the full vehicle catalogue from WG for a given region and upsert
 * into `<region>_vehicles`. Called by the weekly cron (for all regions) and
 * as the cold-start bootstrap inside `loadVehiclesUncached`.
 */
export async function refreshVehiclesFromWG(region: Region): Promise<number> {
  const table = vehiclesByRegion[region];
  const data = await wgFetch<Record<string, WGVehicleRaw>>(
    region,
    "/wot/encyclopedia/vehicles/",
    { fields: VEHICLE_FIELDS },
  );
  const rows: NewVehicle[] = Object.values(data).map((v) => ({
    tankId: v.tank_id,
    tier: v.tier,
    type: v.type,
    nation: v.nation,
    name: v.name,
    shortName: v.short_name,
    tag: v.tag,
    isPremium: v.is_premium,
    isWheeled: v.is_wheeled,
    isGift: v.is_gift,
    smallIcon: v.images?.small_icon ?? null,
    contourIcon: v.images?.contour_icon ?? null,
    bigIcon: v.images?.big_icon ?? null,
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
        smallIcon: table.smallIcon,
        contourIcon: table.contourIcon,
        bigIcon: table.bigIcon,
        updatedAt: new Date(),
      },
    });
  return rows.length;
}

export function computeAvgTier(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
): number | null {
  let weighted = 0;
  let total = 0;
  for (const tank of tanks) {
    const meta = encyclopedia[String(tank.tank_id)];
    const battles = tank.all?.battles ?? 0;
    if (!meta || battles <= 0) continue;
    weighted += meta.tier * battles;
    total += battles;
  }
  return total > 0 ? weighted / total : null;
}
