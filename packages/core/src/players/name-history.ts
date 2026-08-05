import { desc, eq, sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  type NameHistoryEntry,
  playerNameHistoryByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * A player's previous nicknames, newest first. Filled by the `_players` rename
 * trigger, so it stays empty until a rename is observed (WG exposes no history).
 */
export async function getPlayerNameHistory(
  region: Region,
  accountId: number,
): Promise<NameHistoryEntry[]> {
  const table = playerNameHistoryByRegion[region];
  return db
    .select({ nickname: table.nickname, recordedAt: table.recordedAt })
    .from(table)
    .where(eq(table.accountId, accountId))
    .orderBy(desc(table.recordedAt));
}

/**
 * The account that last went by this nickname, so a link to a since-renamed
 * player resolves instead of 404ing.
 *
 * Callers must try the live `players` table first: a freed nickname can be
 * claimed by someone else, and the current holder always wins. Ordering by
 * `recorded_at DESC` picks the most recent former owner when several accounts
 * have carried the name over time.
 */
export async function findAccountIdByFormerNickname(
  region: Region,
  nickname: string,
): Promise<number | null> {
  const table = playerNameHistoryByRegion[region];
  const [row] = await db
    .select({ accountId: table.accountId })
    .from(table)
    .where(sql`LOWER(${table.nickname}) = LOWER(${nickname})`)
    .orderBy(desc(table.recordedAt))
    .limit(1);
  return row?.accountId ?? null;
}
