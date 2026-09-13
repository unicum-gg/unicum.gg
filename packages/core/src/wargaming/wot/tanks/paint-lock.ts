import {
  PaintLock,
  paintLockOf,
} from "@unicum.gg/shared";
import type { Region, WotSrcBranch } from "@unicum.gg/wargaming";
import { wg } from "../../client";
import { cachedInRedis } from "../../../redis";

// Whether the game lets this vehicle be dressed, from the client's own files.
//
// Kept apart from the specs rather than riding on them, though both are read
// out of the same vehicle file: a spec is spread straight into the `tank_specs`
// row, so a field added there is a column, and this is not one. It is the same
// arrangement `based-on` sits in, one fact about a vehicle read on its own.

// wot-src client data changes only on a game patch, so a day is the right life
// for it, like every other read of that mirror on this side.
const WOTSRC_TTL_SECONDS = 24 * 60 * 60;

/**
 * Why this vehicle cannot be painted, or null where it can.
 *
 * **Never guessed from what the wardrobe came back with.** A locked vehicle is
 * still offered styles by the customization filters, which is the whole reason
 * this exists: the Tiger 131 passes 685 of them and the Pz. 58 Mutz 722, while
 * the game lets a player put none of them on either.
 *
 * Null is also what a failed read answers, so a blip at the mirror leaves the
 * wardrobe as it was rather than emptying it: showing paint a player cannot buy
 * is the smaller of the two wrongs against hiding paint they own.
 */
export function getTankPaintLock(
  region: Region,
  tankId: number,
  branch?: WotSrcBranch,
): Promise<PaintLock | null> {
  return cachedInRedis(
    `wotsrc:paint-lock:${region}${branch ? `:${branch}` : ""}:${tankId}`,
    WOTSRC_TTL_SECONDS,
    async () => {
      const own = await wg
        .region(region)
        .source.specs.customization(tankId, branch);
      return own ? paintLockOf(own.tags, own.customDefaultCamouflage) : null;
    },
  );
}
