import { type Region, wgFetch } from ".";
import type { TankStats } from "./tanks";

export type VehicleMeta = { tier: number };

export async function getVehicleEncyclopedia(
  region: Region,
): Promise<Record<string, VehicleMeta>> {
  return wgFetch<Record<string, VehicleMeta>>(
    region,
    "/wot/encyclopedia/vehicles/",
    { fields: "tier" },
    7 * 24 * 60 * 60,
  );
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
