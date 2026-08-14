import { and, desc, gte, isNotNull, sql, type SQL } from "drizzle-orm";
import {
  DEFAULT_STEEL_HUNTER_SORT,
  HR_MIN_BATTLES,
  playersByRegion,
  SteelHunterSort,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getPlayerClansBatch } from "@unicum.gg/core/wargaming/wot/clans/listings";
import { type Region } from "@unicum.gg/wargaming";

// One row of the Steel Hunter (battle-royale) leaderboard. The raw SH totals
// ride along so the UI derives winrate / survival / avg damage without a second
// query (the totals are cached on the players row by the snapshot-cron).
export type TopSteelHunterResult = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  hr: number;
  hrb: number;
  battles: number;
  wins: number;
  survived: number;
  damage: number;
  frags: number;
};

// HRB, the battles-based Hunter Rating: the same HR effectiveness score (XP +
// win rate) but with a growing `ln(1+battles/50)` volume reward instead of HR's
// confidence brake, rescaled (×635) so the median matches HR's. See `hrbColor`
// in @unicum.gg/shared for the canonical formula + calibration; computed inline
// here (rather than a cached column) since it is a pure function of the cached
// sh_* totals. The gate (sh_battles >= 100 AND hr NOT NULL) guarantees a
// positive divisor and a non-null sh_avg_xp.
function hrbSql(players: (typeof playersByRegion)[Region]): SQL {
  return sql`(635.0 * (0.5 * (${players.shAvgXp} / 1034.0) + 0.5 * ((${players.shWins}::float / ${players.shBattles}) / 0.41)) * ln(1 + ${players.shBattles} / 50.0))`;
}

// Per-column ORDER BY. HR rides the partial `*_players_hr_idx`; the derived
// per-battle metrics (winrate/survival/damage) and HRB sort within the same
// gated set (sh_battles >= HR_MIN_BATTLES, so the divisor is always positive), a
// small bitmap-then-sort over a few thousand rows.
function orderExpr(sort: SteelHunterSort, players: (typeof playersByRegion)[Region]): SQL {
  switch (sort) {
    case SteelHunterSort.Hrb:
      return sql`${hrbSql(players)} DESC`;
    case SteelHunterSort.Battles:
      return desc(players.shBattles);
    case SteelHunterSort.Winrate:
      return sql`${players.shWins}::float / ${players.shBattles} DESC`;
    case SteelHunterSort.Survival:
      return sql`${players.shSurvived}::float / ${players.shBattles} DESC`;
    case SteelHunterSort.Damage:
      return sql`${players.shDamage}::float / ${players.shBattles} DESC`;
    default:
      return desc(players.hr);
  }
}

/**
 * The Steel Hunter HR leaderboard for a region: the top players by the chosen
 * `sort` column (HR by default), gated to `sh_battles >= HR_MIN_BATTLES`. A
 * single indexed read of the players table (HR served by the partial
 * `*_players_hr_idx`), then one clan batch for the shown rows, the same shape
 * as the main top-players cache path, never a scan of player_snapshots.
 */
export async function getTopSteelHunter(
  region: Region,
  limit: number,
  sort: SteelHunterSort = DEFAULT_STEEL_HUNTER_SORT,
): Promise<TopSteelHunterResult[]> {
  const players = playersByRegion[region];
  const rows = await db
    .select({
      accountId: players.accountId,
      nickname: players.nickname,
      hr: players.hr,
      hrb: hrbSql(players),
      battles: players.shBattles,
      wins: players.shWins,
      survived: players.shSurvived,
      damage: players.shDamage,
      frags: players.shFrags,
    })
    .from(players)
    .where(
      and(
        gte(players.shBattles, HR_MIN_BATTLES),
        isNotNull(players.hr),
        // HR now implies a non-null avg XP (see updatePlayerRatings), but guard
        // it explicitly so the HRB expression never divides by null on a legacy
        // row written before the sh_avg_xp backfill.
        isNotNull(players.shAvgXp),
      ),
    )
    .orderBy(orderExpr(sort, players))
    .limit(limit);

  const results: TopSteelHunterResult[] = rows.map((r) => ({
    account_id: Number(r.accountId),
    nickname: r.nickname,
    clan_tag: null,
    clan_color: null,
    hr: Math.round(Number(r.hr)),
    hrb: Math.round(Number(r.hrb)),
    battles: r.battles ?? 0,
    wins: r.wins ?? 0,
    survived: r.survived ?? 0,
    damage: Number(r.damage ?? 0),
    frags: r.frags ?? 0,
  }));

  if (results.length > 0) {
    const clansByAccount = await getPlayerClansBatch(
      region,
      results.map((r) => r.account_id),
    );
    for (const r of results) {
      const clan = clansByAccount.get(r.account_id);
      if (clan) {
        r.clan_tag = clan.tag;
        r.clan_color = clan.color;
      }
    }
  }

  return results;
}
