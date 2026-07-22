import "server-only";
import {
  getTankConfigs,
  type TankConfig,
} from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { Region } from "@unicum.gg/wargaming";

// getTankConfigs caches its wot-src fetch+parse in Redis (see core); this is the
// app-level fails-open boundary — any error falls back to the static stock specs
// (no configs).
export async function getTankConfigsCached(
  region: Region,
  tankId: number,
): Promise<TankConfig[]> {
  try {
    return await getTankConfigs(region, tankId);
  } catch {
    return [];
  }
}
