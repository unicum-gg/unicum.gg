import { MIN_MARKS_TIER } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { wg } from "../wargaming/client";

/**
 * A player's Marks of Excellence per tank (tankId -> marks 0-3), from the WoT
 * portal. The public API doesn't expose marks, so this is our only source.
 *
 * Fail-open: portal blips are part of normal operation, so a failure returns an
 * empty map (marks stay null this cycle) rather than throwing into the refresh.
 */
export async function fetchPlayerMarksOnGun(
  region: Region,
  accountId: number,
): Promise<Map<number, number>> {
  try {
    const [rows, encyclopedia] = await Promise.all([
      wg.region(region).portal.profile.vehicleMarks({ accountId }),
      // An in-memory cached read per region, so the tier check below costs this
      // call nothing it was not already paying.
      getVehicleEncyclopedia(region),
    ]);
    const map = new Map<number, number>();
    for (const r of rows) {
      // Marks are 0-3 by definition. Anything else means the portal handed us a
      // different column than we think (its rows are positional and the order
      // moves between responses, which is exactly how battle counts once ended
      // up stored as marks), so drop the value instead of persisting nonsense.
      if (!Number.isInteger(r.marksOnGun) || r.marksOnGun < 0 || r.marksOnGun > 3) {
        continue;
      }
      // The same failure, wearing a value the scale happens to allow. A gun
      // carries no mark below tier V, so a 1, 2 or 3 there is a vehicle with
      // one, two or three battles whose battle count landed in this column, and
      // nothing in the value itself can tell it apart. Measured on EU over
      // 2,000 accounts: of 101 marks stored below tier V, 86 were exactly the
      // vehicle's battle count and not one gun had more than ten battles, while
      // tier V had 3,335 of its 3,360 over ten.
      const tier = encyclopedia[String(r.tankId)]?.tier;
      if (tier == null || tier < MIN_MARKS_TIER) continue;
      map.set(r.tankId, r.marksOnGun);
    }
    return map;
  } catch {
    return new Map();
  }
}
