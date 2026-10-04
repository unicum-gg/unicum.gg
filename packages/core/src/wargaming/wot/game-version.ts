import { Region } from "@unicum.gg/wargaming";
import { wg } from "../client";

/**
 * The live client version, to stamp a snapshot with the patch it belongs to.
 *
 * Wargaming ships the same vehicles and maps to every server, so any region
 * answers; EU matches the mirror branch the catalogues are parsed from. Null
 * when WG does not answer, in which case a caller should skip recording rather
 * than stamp a guess: a wrong version key would attribute a whole patch's
 * changes to the wrong update, and the snapshots are immutable per version.
 */
export async function currentGameVersion(): Promise<string | null> {
  return wg
    .region(Region.EU)
    .api.wot.encyclopedia.info({ fields: ["game_version"] })
    .then((info) => info.game_version ?? null)
    .catch(() => null);
}

/**
 * The same read, on one server rather than on EU.
 *
 * Wargaming rolls an update out region by region, hours apart, so the version
 * live on a voter's own server is not always the version live on EU. That
 * matters wherever the stamp is a statement about a PERSON rather than about
 * the catalogue: a community rating is an opinion of the build its author was
 * playing, which is what lets the page read a verdict against the changes it
 * tracks. The catalogues keep using the region-less read above, since the
 * vehicles and arenas they parse come off the EU mirror branch.
 */
export async function currentRegionGameVersion(
  region: Region,
): Promise<string | null> {
  return wg
    .region(region)
    .api.wot.encyclopedia.info({ fields: ["game_version"] })
    .then((info) => info.game_version ?? null)
    .catch(() => null);
}
