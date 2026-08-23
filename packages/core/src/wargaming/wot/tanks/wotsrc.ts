import { WotSrcBranch, type Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

export type { WotSrcVehicle } from "@unicum.gg/wargaming";
import type { WotSrcVehicle as WotSrcVehicleRow } from "@unicum.gg/wargaming";

export const fetchVehicleCatalog = (region: Region, branch?: WotSrcBranch) =>
  wg.region(region).source.vehicles.catalog(branch);

/**
 * The vehicles the Common Test client has and this region's live one does not.
 *
 * The test build is where a vehicle exists first, so this is what lets us show
 * it weeks before release. Comparing whole catalogues rather than reading a
 * flag is deliberate: the client marks nothing as "unreleased", and a vehicle
 * stops being a test one simply by appearing in the live branch, which this
 * diff picks up on its own at the next refresh.
 *
 * Returns an empty set when no test is running (the branch then mirrors live)
 * or when the branch cannot be read: a Common Test is a bonus, never a reason
 * for the catalogue to fail.
 */
export async function fetchCommonTestVehicles(
  region: Region,
): Promise<Map<number, WotSrcVehicleRow>> {
  try {
    const [live, test] = await Promise.all([
      fetchVehicleCatalog(region),
      fetchVehicleCatalog(region, WotSrcBranch.CT),
    ]);
    const known = new Set(live.map((v) => v.tankId));
    return new Map(test.filter((v) => !known.has(v.tankId)).map((v) => [v.tankId, v]));
  } catch {
    return new Map();
  }
}
