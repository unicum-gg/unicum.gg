import { eq, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { clansByRegion, playersByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

export type LocalPlayerResult = {
  account_id: number;
  nickname: string;
  clan: { tag: string; color: string } | null;
};

/** Escape LIKE metacharacters so a nickname prefix is matched literally. */
const likePrefix = (prefix: string) =>
  `${prefix.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;

/**
 * Prefix search over the locally-tracked players (2M+ rows), served entirely
 * from Postgres so the common case never waits on the rate-limited WG API. The
 * `LOWER(nickname) text_pattern_ops` index makes the `LIKE 'prefix%'` a range
 * scan; results are ordered by lifetime battles so well-known accounts surface
 * first. Clan tag/color come from the joined clans row (null when untracked).
 */
export async function searchPlayersLocal(
  region: Region,
  prefix: string,
  limit = 5,
): Promise<LocalPlayerResult[]> {
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  const rows = await db
    .select({
      accountId: players.accountId,
      nickname: players.nickname,
      clanTag: clans.tag,
      clanColor: clans.color,
    })
    .from(players)
    .leftJoin(clans, eq(players.clanId, clans.id))
    .where(sql`lower(${players.nickname}) like ${likePrefix(prefix)}`)
    .orderBy(sql`${players.battles} desc nulls last`)
    .limit(limit);

  return rows.map((r) => ({
    account_id: Number(r.accountId),
    nickname: r.nickname,
    clan: r.clanTag ? { tag: r.clanTag, color: r.clanColor ?? "#4a4a4a" } : null,
  }));
}
