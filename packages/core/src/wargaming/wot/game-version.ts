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
