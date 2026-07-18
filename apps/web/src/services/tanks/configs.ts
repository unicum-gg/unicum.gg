import "server-only";
import { unstable_cache } from "next/cache";
import {
  getTankConfigs,
  type TankConfig,
} from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { Region } from "@unicum.gg/wargaming";

// The combinations come from the wot-src client XML mirror (static game data
// that only changes on a game patch), so a 6h cache keeps every tank page off
// the raw-file fetch + XML parse. Fails open: any error returns no configs and
// the page falls back to the static stock specs.
const REVALIDATE_SECONDS = 6 * 60 * 60;

const configsCached = unstable_cache(
  (region: Region, tankId: number) => getTankConfigs(region, tankId),
  ["tank-configs"],
  { revalidate: REVALIDATE_SECONDS, tags: ["tank-configs"] },
);

export async function getTankConfigsCached(
  region: Region,
  tankId: number,
): Promise<TankConfig[]> {
  try {
    return await configsCached(region, tankId);
  } catch {
    return [];
  }
}
