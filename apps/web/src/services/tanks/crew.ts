import "server-only";
import { unstable_cache } from "next/cache";
import {
  getTankCrew,
  type TankCrew,
} from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { Region } from "@unicum.gg/wargaming";

// Crew composition + the skill catalogue come from static WG/wot-src data that
// changes only on a game patch, so a 6h cache keeps every tank page off the
// fetch + parse. Fails open: any error returns no crew and the page hides the
// section.
const REVALIDATE_SECONDS = 6 * 60 * 60;

const crewCached = unstable_cache(
  (region: Region, tankId: number) => getTankCrew(region, tankId),
  ["tank-crew"],
  { revalidate: REVALIDATE_SECONDS, tags: ["tank-crew"] },
);

export async function getTankCrewCached(
  region: Region,
  tankId: number,
): Promise<TankCrew | null> {
  try {
    return await crewCached(region, tankId);
  } catch {
    return null;
  }
}
