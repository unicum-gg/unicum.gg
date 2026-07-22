import "server-only";
import {
  getTankLoadout,
  type TankLoadout,
} from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { Region } from "@unicum.gg/wargaming";

// getTankLoadout caches its wot-src fetch+parse in Redis (see core); this is the
// app-level fails-open boundary — any error hides the equipment section.
export async function getTankLoadoutCached(
  region: Region,
  tankId: number,
): Promise<TankLoadout | null> {
  try {
    return await getTankLoadout(region, tankId);
  } catch {
    return null;
  }
}
