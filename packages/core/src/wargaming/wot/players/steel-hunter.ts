import { and, desc, eq, gte, isNotNull, sql, type SQL } from "drizzle-orm";
import {
  clansByRegion,
  DEFAULT_STEEL_HUNTER_SORT,
  HR_MIN_BATTLES,
  HR_W_WIN,
  HR_W_XP,
  HR_WR_BASE,
  HR_XP_BASE,
  HRB_SCALE,
  HRB_VOLUME_K,
  playersByRegion,
  SteelHunterSort,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
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

// Every constant enters the expression as a float literal: `sh_battles` is an
// integer column, so `sh_battles / 50` would truncate, and a bound parameter
// would leave postgres with a type it cannot infer inside the arithmetic.
function float(n: number): SQL {
  return sql.raw(Number.isInteger(n) ? `${n}.0` : String(n));
}

// HRB, the battles-based Hunter Rating: the same HR effectiveness score (XP +
// win rate) but with a growing `ln(1+battles/50)` volume reward instead of HR's
// confidence brake, rescaled (×635) so the median matches HR's. The same formula
// as `computeHRB` in @unicum.gg/shared, whose constants it reads, evaluated here
// in SQL because the board ranks the whole population; computed inline (rather
// than a cached column) since it is a pure function of the cached sh_* totals.
// The gate (sh_battles >= 100 AND hr NOT NULL) guarantees a positive divisor and
// a non-null sh_avg_xp.
function hrbSql(players: (typeof playersByRegion)[Region]): SQL {
  return sql`(${float(HRB_SCALE)} * (${float(HR_W_XP)} * (${players.shAvgXp} / ${float(HR_XP_BASE)}) + ${float(HR_W_WIN)} * ((${players.shWins}::float / ${players.shBattles}) / ${float(HR_WR_BASE)})) * ln(1 + ${players.shBattles} / ${float(HRB_VOLUME_K)}))`;
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
  const clans = clansByRegion[region];
  // Resolve the shown rows' clan tag/color from our own clans table (LEFT JOIN on
  // players.clan_id), the same way the materialized top-players path does, rather
  // than a live WG `clans/accountinfo` batch. That live fetch was this endpoint's
  // entire cost: 0.8-13s on the request path, the single slowest thing we served.
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
      clanTag: clans.tag,
      clanColor: clans.color,
    })
    .from(players)
    .leftJoin(clans, eq(clans.id, players.clanId))
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

  return rows.map((r) => ({
    account_id: Number(r.accountId),
    nickname: r.nickname,
    clan_tag: r.clanTag ?? null,
    clan_color: r.clanColor ?? null,
    hr: Math.round(Number(r.hr)),
    hrb: Math.round(Number(r.hrb)),
    battles: r.battles ?? 0,
    wins: r.wins ?? 0,
    survived: r.survived ?? 0,
    damage: Number(r.damage ?? 0),
    frags: r.frags ?? 0,
  }));
}
