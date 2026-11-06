import { eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { type PlayerSnapshot, tankSnapshotsByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { PlayerInfo } from "@unicum.gg/core/wargaming/wot/accounts";

/**
 * Whether this fetch's tanks must be held back because the account has not
 * caught up with them.
 *
 * Wargaming's `account/info` `statistics.all` can lag `tanks/stats` by hours:
 * the pipeline sees `last_battle_time` move, fetches the tanks, and they already
 * count a battle the account total does not. Written anyway, that tank row has
 * no account row beside it, and every period diff then reads a battle on the
 * tank side and none on the account side, so the profile showed an average
 * tier, a combined damage and a WN8 under a Battles row reading 0 (okuni on EU,
 * 2026-11-02, where the account caught up the next day).
 *
 * Both `all` blocks are random, clan and company, so an account total that did
 * not move means no tank's `all` legitimately moved either: anything the tanks
 * say beyond it is the lag. Holding them back costs nothing, since `tanks/stats`
 * is cumulative and the next snapshot writes the same battle on both sides at
 * once, which is what the account side was already doing. A session played
 * only in a mode outside `all` (Stronghold, Onslaught) moves neither, so it is
 * unaffected, and the per-mode blocks are still written by the caller.
 *
 * The one exception is an account holding no tank rows at all (a first fetch
 * whose tanks call failed): those are seeded, since there is nothing for them
 * to disagree with and nothing would ever write them otherwise.
 */
export async function tanksAheadOfAccount(
  region: Region,
  playerId: number,
  latest: PlayerSnapshot | undefined,
  info: PlayerInfo,
): Promise<boolean> {
  if (!latest || latest.battles !== info.statistics.all.battles) return false;
  const tankSnapshots = tankSnapshotsByRegion[region];
  const [held] = await db
    .select({ playerId: tankSnapshots.playerId })
    .from(tankSnapshots)
    .where(eq(tankSnapshots.playerId, playerId))
    .limit(1);
  return held !== undefined;
}
