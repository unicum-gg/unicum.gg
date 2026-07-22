import "server-only";
import {
  getTankCrew,
  type TankCrew,
} from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { Region } from "@unicum.gg/wargaming";

// getTankCrew caches its wot-src fetch+parse in Redis (see core); this is the
// app-level fails-open boundary — any error hides the crew section.
export async function getTankCrewCached(
  region: Region,
  tankId: number,
): Promise<TankCrew | null> {
  try {
    return await getTankCrew(region, tankId);
  } catch {
    return null;
  }
}
