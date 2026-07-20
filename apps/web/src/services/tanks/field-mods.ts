import "server-only";
import { unstable_cache } from "next/cache";
import {
  getTankFieldMods,
  type TankFieldMods,
} from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { Region } from "@unicum.gg/wargaming";

// The post-progression trees come from the static wot-src client XML (changes
// only on a game patch), so a 6h cache keeps every tank page off the raw-file
// fetch + parse. Fails open: any error returns no tree and the page shows no
// field-modifications section.
const REVALIDATE_SECONDS = 6 * 60 * 60;

const fieldModsCached = unstable_cache(
  (region: Region, tankId: number) => getTankFieldMods(region, tankId),
  ["tank-field-mods"],
  { revalidate: REVALIDATE_SECONDS, tags: ["tank-field-mods"] },
);

export async function getTankFieldModsCached(
  region: Region,
  tankId: number,
): Promise<TankFieldMods | null> {
  try {
    return await fieldModsCached(region, tankId);
  } catch {
    return null;
  }
}
