import { and, desc, eq, gte, isNotNull, sql, type SQL } from "drizzle-orm";
import {
  clansByRegion,
  DEFAULT_RAMPAGE_SORT,
  MR_MIN_BATTLES,
  playersByRegion,
  RampageSort,
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
  battles: number;
  wins: number;
  survived: number;
  damage: number;
  frags: number;
};

// Per-column ORDER BY. MR rides the partial `*_players_hr_idx`; the derived
// per-battle metrics (winrate/survival/damage) sort within the same gated set
// (sh_battles >= MR_MIN_BATTLES, so the divisor is always positive), a small
// bitmap-then-sort over a few thousand rows.
function orderExpr(sort: RampageSort, players: (typeof playersByRegion)[Region]): SQL {
  switch (sort) {
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
        // it explicitly so a legacy row written before the sh_avg_xp backfill
        // cannot reach the board with no effectiveness behind its rating.
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
    battles: r.battles ?? 0,
    wins: r.wins ?? 0,
    survived: r.survived ?? 0,
    damage: Number(r.damage ?? 0),
    frags: r.frags ?? 0,
  }));
}
