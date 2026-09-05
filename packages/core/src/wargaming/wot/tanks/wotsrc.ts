import { poFilename, WotSrcBranch, type Region } from "@unicum.gg/wargaming";
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

/**
 * How a vehicle enters our catalogue, decided from where the client declares its
 * name (`WotSrcVehicle.nameSource`) and whether that declaration resolved.
 *
 * The client declares a vehicle's name outside its nation's own catalogue for
 * two very different reasons, and the file tells them apart.
 *
 * A `*_vehicles` file that is not the nation's own is a parallel catalogue of
 * real, playable vehicles: `igr_vehicles` holds the cybercafe reissues that
 * partner internet clubs handed out, and players still have battles on them
 * (2343 accounts across the 47 of them on ASIA alone). They are kept, but their
 * name is the name of the vehicle they reissue, so the file's own prefix becomes
 * a suffix: `igr_vehicles` -> "WZ-132 IGR". Without it two vehicles slugify to
 * `wz-132` and the tech-tree one loses its URL to a collision.
 *
 * Anything else is not a vehicle: `maps_training` are the training-room bots and
 * `story_mode.sm_battle` the coastal bunkers. Neither has a single battle
 * recorded on any region, so they are hidden outright, as is the one entry the
 * client declares in a nation catalogue but never actually names (the shelling
 * prop `Env_Artillery`).
 *
 * Reading the declaration rather than listing tags means a variant catalogue we
 * have never seen is handled on the day it ships instead of silently colliding.
 * `isNamed` is read separately from `nameSource` on purpose: they answer
 * different questions, and hiding on the union of the two would turn one failed
 * localization fetch into a whole nation disappearing from the catalogue.
 */
export function catalogueNaming(
  v: Pick<
    WotSrcVehicleRow,
    "name" | "shortName" | "nameSource" | "isNamed" | "nation"
  >,
): { name: string; shortName: string; variant: string | null; isHidden: boolean } {
  // `poFilename` rather than a second copy of the rule: Britain's catalogue file
  // does not match its directory name, and that exception has one owner.
  const own = poFilename(v.nation);
  // Suffixed off `name` when the short one is blank, which the mirror leaves it
  // for every vehicle whose short name equals its full name. Suffixing the blank
  // would store a truthy " IGR" and defeat the `shortName || name` fallback the
  // encyclopedia read relies on, slugging the vehicle as `igr`.
  const shortName = v.shortName || v.name;
  const plain = { name: v.name, shortName, variant: null };
  if (!v.isNamed || v.nameSource === null || !v.nameSource.endsWith("_vehicles")) {
    return { ...plain, isHidden: true };
  }
  if (v.nameSource === own) return { ...plain, isHidden: false };
  const variant = v.nameSource.slice(0, -"_vehicles".length).toUpperCase();
  return {
    name: `${v.name} ${variant}`,
    shortName: `${shortName} ${variant}`,
    variant,
    isHidden: false,
  };
}
