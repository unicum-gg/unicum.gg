import { eq, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { maneuversPlayersByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * How many Maneuvers editions this account held a place on, for the player
 * page's mode row: an account the event never ranked has no tab. One row per
 * edition per account, read off `*_maneuvers_players_account_idx`.
 */
export async function countPlayerManeuversEditions(
  region: Region,
  accountId: number,
): Promise<number> {
  const entries = maneuversPlayersByRegion[region];
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(entries)
    .where(eq(entries.accountId, accountId));
  return row?.count ?? 0;
}
