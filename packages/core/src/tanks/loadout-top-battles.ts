import { sql } from "drizzle-orm";
import {
  clansByRegion,
  type LoadoutMode,
  loadoutPrivacy,
  type TopBattle,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
import { battlesCte } from "@unicum.gg/core/tanks/loadout-sql";

/**
 * The vehicle's best battles, and exactly what was fitted for each.
 *
 * The aggregate next door answers what the population runs; this picks the
 * battles that show a setup at work. Only their keys and their players are
 * read here: the endpoint draws each battle through the Battles tab's own
 * reader. One battle per
 * player, their best: ranked across every battle, one player on a good week
 * would fill the list and it would describe them rather than the vehicle.
 *
 * Ranked on damage dealt, which is the figure a battle report leads with and
 * the one a reader compares first. It is a battle's result, not a career's, so
 * nothing here needs the snapshot history the garage version was ranked on.
 *
 * A player who asked not to be shown is excluded HERE, in the query, rather than
 * by whoever calls this. Their battles still count towards every share the
 * aggregate publishes, which is what the privacy flag means (it governs
 * attribution, not collection), but this list attributes by name, so it is the
 * one place that has to honour it.
 */

/** How many battles the list shows. Enough to see whether the top of a vehicle
 * agrees with itself, which two or three cannot show and fifty would bury. */
const TOP_BATTLE_COUNT = 10;

type BestRow = {
  arena_unique_id: string;
  started_at: string | Date;
  account_id: string | number;
  nickname: string | null;
  clan_tag: string | null;
  clan_color: string | null;
};

export async function topTankBattles(
  region: Region,
  tankId: number,
  mode: LoadoutMode,
): Promise<TopBattle[]> {
  const clans = clansByRegion[region];
  const rows = (await db.execute(sql`
    WITH observed AS (${battlesCte(region, tankId, mode)}),
    best AS (
      SELECT DISTINCT ON (account_id) *
      FROM observed o
      WHERE NOT EXISTS (
        SELECT 1 FROM ${loadoutPrivacy} lp
        WHERE lp.wargaming_account = ${region} || '-' || o.account_id
          AND lp.hidden
      )
      ORDER BY account_id, damage DESC NULLS LAST, started_at DESC
    )
    SELECT best.arena_unique_id, best.started_at, best.account_id, best.nickname,
           c.tag AS clan_tag, c.color AS clan_color
    FROM best
    LEFT JOIN ${clans} c ON c.id = best.clan_id
    ORDER BY best.damage DESC NULLS LAST, best.started_at DESC
    LIMIT ${TOP_BATTLE_COUNT}
  `)) as unknown as BestRow[];
  if (rows.length === 0) return [];

  // The crests a name wears everywhere else on the site, for the ten only.
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
      nickname: row.nickname ?? String(accountId),
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
