import { unstable_cache } from "next/cache";
import type { Region } from ".";
import { wgFetch } from "./fetch";
import type { TankStats } from "./tanks";

export type VehicleMeta = { tier: number };

// Vehicle tiers change at most once per game patch (months), so we cache
// for a week. `unstable_cache` keys by region argument automatically.
export const getVehicleEncyclopedia = unstable_cache(
  async (region: Region): Promise<Record<string, VehicleMeta>> => {
    return wgFetch<Record<string, VehicleMeta>>(
      region,
      "/wot/encyclopedia/vehicles/",
      { fields: "tier" },
    );
  },
  ["vehicle-encyclopedia"],
  { revalidate: 7 * 24 * 60 * 60, tags: ["encyclopedia"] },
);

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
