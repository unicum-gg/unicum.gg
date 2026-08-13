import { desc, inArray, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { clansByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

export type LocalClanResult = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  members_count: number;
  emblem: string | null;
};

/** Escape LIKE metacharacters so a tag prefix is matched literally. */
const likePrefix = (prefix: string) =>
  `${prefix.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;

/**
 * Prefix search over locally-tracked clans, served from Postgres so the common
 * case never waits on the rate-limited WG API. Matches the tag prefix (the
 * `tag_lower text_pattern_ops` index makes it a range scan) and orders by
 * member count so the big, recognisable clans surface first. Name-only matches
 * are left to the WG chunk that streams in after.
 */
export async function searchClansLocal(
  region: Region,
  prefix: string,
  limit = 5,
): Promise<LocalClanResult[]> {
  const clans = clansByRegion[region];
  const rows = await db
    .select({
      id: clans.id,
      tag: clans.tag,
      name: clans.name,
      color: clans.color,
      membersCount: clans.membersCount,
      emblem: clans.emblem,
    })
    .from(clans)
    .where(sql`${clans.tagLower} like ${likePrefix(prefix)}`)
    .orderBy(desc(clans.membersCount))
    .limit(limit);

  return rows.map(toLocalClanResult);
}

/**
 * The same rows, addressed by clan id instead of by tag prefix. Backs the search
 * dialog's saved entries, which keep the id and ask for the current row rather
 * than storing a copy of it: a clan renames, and a stored copy keeps showing the
 * tag it carried the day it was pinned.
 *
 * Ids we no longer have a row for are dropped, and the caller keeps its own copy
 * for those, so a dropped id is a stale row rather than a missing one.
 */
export async function getClansByIds(
  region: Region,
  clanIds: number[],
): Promise<LocalClanResult[]> {
  if (clanIds.length === 0) return [];
  const clans = clansByRegion[region];
  const rows = await db
    .select({
      id: clans.id,
      tag: clans.tag,
      name: clans.name,
      color: clans.color,
      membersCount: clans.membersCount,
      emblem: clans.emblem,
    })
    .from(clans)
    .where(inArray(clans.id, clanIds));

  return rows.map(toLocalClanResult);
}

/** One mapping for both lookups, so a prefix hit and a resolved entry are the
 * same row. */
function toLocalClanResult(row: {
  id: number | string | bigint;
  tag: string;
  name: string;
  color: string;
  membersCount: number;
  emblem: string | null;
}): LocalClanResult {
  return {
    clan_id: Number(row.id),
    tag: row.tag,
    name: row.name,
    color: row.color,
    members_count: row.membersCount,
    emblem: row.emblem,
  };
}
