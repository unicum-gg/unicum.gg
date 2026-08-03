import type { Region } from "@unicum.gg/wargaming";
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
    const rows = await wg
      .region(region)
      .portal.profile.vehicleMarks({ accountId });
    const map = new Map<number, number>();
    for (const r of rows) {
      // Marks are 0-3 by definition. Anything else means the portal handed us a
      // different column than we think (its rows are positional and the order
      // moves between responses, which is exactly how battle counts once ended
      // up stored as marks), so drop the value instead of persisting nonsense.
      if (!Number.isInteger(r.marksOnGun) || r.marksOnGun < 0 || r.marksOnGun > 3) {
        continue;
      }
      map.set(r.tankId, r.marksOnGun);
    }
    return map;
  } catch {
    return new Map();
  }
}
