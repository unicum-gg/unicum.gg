import { sql } from "drizzle-orm";
import {
  clansByRegion,
  type LoadoutMode,
  loadoutPrivacy,
  playersByRegion,
  type TopBattle,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
import { recordsCte } from "@unicum.gg/core/maps/statistics-sql";

/**
 * The best battles fought on a map, one per player, by damage dealt.
 *
 * The vehicle page's list next door, asked of a map instead: only the keys and
 * the players are read here, and the endpoint draws each battle through the
 * Battles tab's own reader so it looks the same wherever it appears.
 *
 * Damage rather than a rating, for the same reason as there: it is the figure
 * a battle report leads with. It does favour the top tiers, which is what the
 * map's best battles are, and the cards say the tier on every row.
 *
 * Only accounts we track can be named (an unknown account has no nickname to
 * show), and a player who asked not to be attributed is excluded HERE, in the
 * query, while still counting towards every figure on the page.
 */

const TOP_BATTLE_COUNT = 10;

type BestRow = {
  arena_unique_id: string;
  started_at: string | Date;
  account_id: string | number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
};

export async function topMapBattles(
  region: Region,
  arenas: string[],
  mode: LoadoutMode,
): Promise<TopBattle[]> {
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  const rows = (await db.execute(sql`
    WITH r AS (${recordsCte(region, arenas, mode)}),
    best AS (
      SELECT DISTINCT ON (r.account_id)
             r.account_id, r.arena_unique_id, r.started_at, r.damage,
             p.nickname, p.clan_id
      FROM r
      JOIN ${players} p ON p.account_id = r.account_id
      WHERE NOT EXISTS (
        SELECT 1 FROM ${loadoutPrivacy} lp
        WHERE lp.wargaming_account = ${region} || '-' || r.account_id
          AND lp.hidden
      )
      ORDER BY r.account_id, r.damage DESC, r.started_at DESC
    )
    SELECT best.arena_unique_id, best.started_at, best.account_id, best.nickname,
           c.tag AS clan_tag, c.color AS clan_color
    FROM best
    LEFT JOIN ${clans} c ON c.id = best.clan_id
    ORDER BY best.damage DESC, best.started_at DESC
    LIMIT ${TOP_BATTLE_COUNT}
  `)) as unknown as BestRow[];
  if (rows.length === 0) return [];

  const badges = await resolvePlayerBadges(
    region,
    rows.map((row) => Number(row.account_id)),
  );

  return rows.map((row) => {
    const accountId = Number(row.account_id);
    const badge = badges.get(accountId);
    return {
      arenaUniqueId: row.arena_unique_id,
      startedAt: new Date(row.started_at),
      nickname: row.nickname,
      accountId,
      clanTag: row.clan_tag,
      clanColor: row.clan_color,
      isVerified: badge?.verified ?? false,
      isSupporter: badge?.supporter ?? false,
      twitchLogin: badge?.twitchLogin ?? null,
      tournamentWins: badge?.tournamentWins ?? 0,
      tournamentFeaturedWins: badge?.tournamentFeaturedWins ?? 0,
      tournamentBestTitle: badge?.tournamentBestTitle ?? null,
      onslaughtBestTier: badge?.onslaughtBestTier ?? null,
      onslaughtBestRank: badge?.onslaughtBestRank ?? null,
      onslaughtSeasons: badge?.onslaughtSeasons ?? 0,
    } satisfies TopBattle;
  });
}
