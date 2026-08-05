import { desc, eq, sql } from "drizzle-orm";
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

/**
 * The clan that last went by this tag, so a link to a since-retagged clan
 * resolves instead of 404ing. Same rule as the player counterpart: the caller
 * must try the live `clans` table first, because a freed tag can be taken by
 * another clan and the current holder always wins.
 */
export async function findClanIdByFormerTag(
  region: Region,
  tag: string,
): Promise<number | null> {
  const table = clanNameHistoryByRegion[region];
  const [row] = await db
    .select({ clanId: table.clanId })
    .from(table)
    .where(sql`LOWER(${table.tag}) = LOWER(${tag})`)
    .orderBy(desc(table.recordedAt))
    .limit(1);
  return row?.clanId ?? null;
}
