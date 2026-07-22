import "server-only";
import {
  getTankFieldMods,
  type TankFieldMods,
} from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { Region } from "@unicum.gg/wargaming";

// getTankFieldMods caches its wot-src fetch+parse in Redis (see core); this is
// the app-level fails-open boundary — any error hides the field-mods section.
export async function getTankFieldModsCached(
  region: Region,
  tankId: number,
): Promise<TankFieldMods | null> {
  try {
    return await getTankFieldMods(region, tankId);
  } catch {
    return null;
  }
}
