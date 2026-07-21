import { desc, eq } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import { clanNameHistoryByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/** A clan's previous tag + name, with when it stopped being current. */
export type ClanNameHistoryEntry = {
  tag: string;
  name: string;
  recordedAt: Date;
};

/**
 * A clan's previous tags + names, newest first. Filled by the `_clans` rename
 * trigger, so it stays empty until a rename is observed.
 */
export async function getClanNameHistory(
  region: Region,
  clanId: number,
): Promise<ClanNameHistoryEntry[]> {
  const table = clanNameHistoryByRegion[region];
  return db
    .select({
      tag: table.tag,
      name: table.name,
      recordedAt: table.recordedAt,
    })
    .from(table)
    .where(eq(table.clanId, clanId))
    .orderBy(desc(table.recordedAt));
}
