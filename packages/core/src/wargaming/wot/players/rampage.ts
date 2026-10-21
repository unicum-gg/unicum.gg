import { and, desc, eq, gte, isNotNull, sql, type SQL } from "drizzle-orm";
import {
  clansByRegion,
  DEFAULT_RAMPAGE_SORT,
  MODE_RATING_ANCHORS,
  MR_MIN_BATTLES,
  MR_SCALE,
  MR_W_WIN,
  MR_W_XP,
  MRB_SCORE_BASE,
  MRB_VOLUME_K,
  playersByRegion,
  RampageSort,
  RatedMode,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";

// One row of the Rampage leaderboard. The raw totals ride along so the UI
// derives winrate / survival / avg damage without a second query (they are
// cached on the players row by the snapshot-cron).
//
// The `sh_*` column names and `hr` are kept from when this board was published
// as Steel Hunter, which it never was: it reads `statistics.fallout`, the 2015
// Rampage event. They are physical names on a two-million-row table in three
// regions and renaming them has to land with its own deploy, so what they hold
// is said here instead. `hr` holds MR (see `computeMR`).
export type TopRampageResult = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  mr: number;
  mrb: number;
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

// MRB, the volume-rewarding sibling of MR: the same effectiveness score (XP +
// win rate, each against Rampage's own median) with a growing `ln(1+battles/50)`
// term instead of MR's confidence brake, divided by the mode's own median so its
// median player lands at 1000 like MR's. The same formula as `computeMRB` in
// @unicum.gg/shared, whose constants it reads, evaluated here in SQL because the
// board ranks the whole population; computed inline (rather than a cached
// column) since it is a pure function of the cached sh_* totals. The gate
// (sh_battles >= 100 AND hr NOT NULL) guarantees a positive divisor and a
// non-null sh_avg_xp.
function mrbSql(players: (typeof playersByRegion)[Region]): SQL {
  const a = MODE_RATING_ANCHORS[RatedMode.Rampage];
  return sql`(${float(MR_SCALE)} * (${float(MR_W_XP)} * (${players.shAvgXp} / ${float(a.xpBase)}) + ${float(MR_W_WIN)} * ((${players.shWins}::float / ${players.shBattles}) / ${float(a.wrBase)})) * ln(1 + ${players.shBattles} / ${float(MRB_VOLUME_K)}) / ${float(MRB_SCORE_BASE)})`;
}

// Per-column ORDER BY. MR rides the partial `*_players_hr_idx`; the derived
// per-battle metrics (winrate/survival/damage) and MRB sort within the same
// gated set (sh_battles >= MR_MIN_BATTLES, so the divisor is always positive), a
// small bitmap-then-sort over a few thousand rows.
function orderExpr(sort: RampageSort, players: (typeof playersByRegion)[Region]): SQL {
  switch (sort) {
    case RampageSort.Mrb:
      return sql`${mrbSql(players)} DESC`;
    case RampageSort.Battles:
      return desc(players.shBattles);
    case RampageSort.Winrate:
      return sql`${players.shWins}::float / ${players.shBattles} DESC`;
    case RampageSort.Survival:
      return sql`${players.shSurvived}::float / ${players.shBattles} DESC`;
    case RampageSort.Damage:
      return sql`${players.shDamage}::float / ${players.shBattles} DESC`;
    default:
      return desc(players.hr);
  }
}

/**
 * The Rampage MR leaderboard for a region: the top players by the chosen `sort`
 * column (MR by default), gated to `sh_battles >= MR_MIN_BATTLES`. A single
 * indexed read of the players table (MR served by the partial
 * `*_players_hr_idx`), then one clan batch for the shown rows, the same shape
 * as the main top-players cache path, never a scan of player_snapshots.
 *
 * **It is an archive, and the one thing to know before reading a rank off it.**
 * Rampage ended in May 2016, so no row here can move again: measured on the top
 * 100, not one account gained a Rampage battle over 144 days of observation
 * while 74 of them played World of Tanks inside the last 90. The board still
 * GROWS, from 3,300 ranked accounts to 9,110, purely because we keep
 * discovering accounts that played it a decade ago.
 */
export async function getTopRampage(
  region: Region,
  limit: number,
  sort: RampageSort = DEFAULT_RAMPAGE_SORT,
): Promise<TopRampageResult[]> {
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
      mr: players.hr,
      mrb: mrbSql(players),
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
        gte(players.shBattles, MR_MIN_BATTLES),
        isNotNull(players.hr),
        // MR now implies a non-null avg XP (see updatePlayerRatings), but guard
        // it explicitly so the MRB expression never divides by null on a legacy
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
    mr: Math.round(Number(r.mr)),
    mrb: Math.round(Number(r.mrb)),
    battles: r.battles ?? 0,
    wins: r.wins ?? 0,
    survived: r.survived ?? 0,
    damage: Number(r.damage ?? 0),
    frags: r.frags ?? 0,
  }));
}
