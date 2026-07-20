import "server-only";
import { unstable_cache } from "next/cache";
import {
  getTankSkillTree,
  type TankSkillTree,
} from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import type { Region } from "@unicum.gg/wargaming";

// The tier-XI skill trees come from the static wot-src client XML (changes only
// on a game patch), so a 6h cache keeps every tank page off the raw-file fetch +
// parse. Fails open: any error returns no tree and the page shows no upgrades.
const REVALIDATE_SECONDS = 6 * 60 * 60;

const skillTreeCached = unstable_cache(
  (region: Region, tankId: number) => getTankSkillTree(region, tankId),
  ["tank-skill-tree"],
  { revalidate: REVALIDATE_SECONDS, tags: ["tank-skill-tree"] },
);

export async function getTankSkillTreeCached(
  region: Region,
  tankId: number,
): Promise<TankSkillTree | null> {
  try {
    return await skillTreeCached(region, tankId);
  } catch {
    return null;
  }
}
