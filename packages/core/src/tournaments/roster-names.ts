import { desc, eq, sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  tournamentTeamPlayersByRegion,
  tournamentsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * The account that entered a tournament under this nickname.
 *
 * The rosters are the only archive of PAST names we hold. `player_name_history`
 * records a rename we watched happen, so it starts the day we started watching
 * the account and knows nothing about the years before: on EU it holds 462 rows
 * against 147,800 distinct roster nicknames that no player carries today. Those
 * names are linked from our own team pages (the roster falls back to the
 * recorded name for an account we do not track yet), so every one of them was a
 * link into a 404 until this read existed.
 *
 * Callers must try the live `players` table and Wargaming first, for the same
 * reason the rename history is read last: a freed nickname can be claimed by
 * somebody else, and the current holder always wins. Ordering by the
 * tournament's own start date picks the most recent entrant when several
 * accounts have carried the name over the years.
 */
export async function findAccountIdByRosterNickname(
  region: Region,
  nickname: string,
): Promise<number | null> {
  const rosters = tournamentTeamPlayersByRegion[region];
  const tournaments = tournamentsByRegion[region];
  const [row] = await db
    .select({ accountId: rosters.accountId })
    .from(rosters)
    .innerJoin(tournaments, eq(tournaments.id, rosters.tournamentId))
    .where(sql`LOWER(${rosters.nickname}) = LOWER(${nickname})`)
    .orderBy(desc(tournaments.startAt))
    .limit(1);
  return row?.accountId ?? null;
}
