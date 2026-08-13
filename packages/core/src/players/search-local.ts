import { eq, inArray, sql } from "drizzle-orm";
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

  return rows.map(toLocalPlayerResult);
}

/**
 * The same rows, addressed by account id instead of by nickname prefix. Backs
 * the search dialog's saved entries, which keep the id and ask for the current
 * row rather than storing a copy of it: a nickname and a clan tag are exactly
 * the two fields a stored copy gets wrong.
 *
 * Ids we no longer have a row for are dropped, and the caller keeps its own copy
 * for those, so a dropped id is a stale row rather than a missing one.
 */
export async function getPlayersByAccountIds(
  region: Region,
  accountIds: number[],
): Promise<LocalPlayerResult[]> {
  if (accountIds.length === 0) return [];
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
    .where(inArray(players.accountId, accountIds));

  return rows.map(toLocalPlayerResult);
}

/** One mapping for both lookups, so a prefix hit and a resolved entry are the
 * same row down to the fallback clan colour. */
function toLocalPlayerResult(row: {
  accountId: number | string | bigint;
  nickname: string;
  clanTag: string | null;
  clanColor: string | null;
}): LocalPlayerResult {
  return {
    account_id: Number(row.accountId),
    nickname: row.nickname,
    clan: row.clanTag
      ? { tag: row.clanTag, color: row.clanColor ?? "#4a4a4a" }
      : null,
  };
}
