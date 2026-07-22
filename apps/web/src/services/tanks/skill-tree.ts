import "server-only";
import {
  getTankSkillTree,
  type TankSkillTree,
} from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import type { Region } from "@unicum.gg/wargaming";

// getTankSkillTree caches its wot-src fetch+parse in Redis (see core); this is
// the app-level fails-open boundary — any error hides the upgrades section.
export async function getTankSkillTreeCached(
  region: Region,
  tankId: number,
): Promise<TankSkillTree | null> {
  try {
    return await getTankSkillTree(region, tankId);
  } catch {
    return null;
  }
}
