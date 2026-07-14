import { desc, sql } from "drizzle-orm";
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

  return rows.map((r) => ({
    clan_id: Number(r.id),
    tag: r.tag,
    name: r.name,
    color: r.color,
    members_count: r.membersCount,
    emblem: r.emblem,
  }));
}
