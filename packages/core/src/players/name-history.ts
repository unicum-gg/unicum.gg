import { desc, eq } from "drizzle-orm";
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
