import { archivedMinimapUrl } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

/** A map's minimap as the archived full clients drew it (0.6.2 to 0.9.7, and
 * 1.15.0), one image per version that redrew it, oldest first, each with the
 * last version it is known to hold for. Empty when the archive carries none:
 * the history then draws those versions on the latest minimap and says so. */
export async function getLegacyMinimaps(
  region: Region,
  arenaId: string,
): Promise<{ version: string; through: string; url: string }[]> {
  const index = await wg.region(region).source.archivedArenas.legacyMinimaps();
  return (index[arenaId] ?? []).map(({ version, through }) => ({
    version,
    through,
    url: archivedMinimapUrl(`history/${arenaId}/${version}.webp`),
  }));
}
