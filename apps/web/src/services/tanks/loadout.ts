import "server-only";
import { unstable_cache } from "next/cache";
import {
  getTankLoadout,
  type TankLoadout,
} from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { Region } from "@unicum.gg/wargaming";

// Equipment slots + effects come from the static wot-src client XML (changes
// only on a game patch), so a 6h cache keeps every tank page off the raw-file
// fetch + parse. Fails open: any error returns no loadout and the page shows no
// equipment section.
const REVALIDATE_SECONDS = 6 * 60 * 60;

const loadoutCached = unstable_cache(
  (region: Region, tankId: number) => getTankLoadout(region, tankId),
  ["tank-loadout"],
  { revalidate: REVALIDATE_SECONDS, tags: ["tank-loadout"] },
);

export async function getTankLoadoutCached(
  region: Region,
  tankId: number,
): Promise<TankLoadout | null> {
  try {
    return await loadoutCached(region, tankId);
  } catch {
    return null;
  }
}
