import { sql, type SQL } from "drizzle-orm";
import {
  battleLoadoutsByRegion,
  battlesByRegion,
  LOADOUT_MODE_BATTLES,
  LOADOUT_MODES,
  LOADOUT_WINDOW_DAYS,
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type LoadoutMode,
  playersByRegion,
  type LoadoutPerformance,
  type LoadoutRatings,
  RatingMetric,
  type TankStats,
  type VehicleMeta,
  type WN8Expected,
  type WNXExpected,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";

/**
 * The scaffolding every loadout aggregate is built on.
 *
 * Several statements ask different questions of the same battles, and they
 * have to agree about which battles those are and how a row's performance is
 * computed, or the shares on one panel would be over a different denominator
 * than the shares on the next. So the battle set and the performance columns
 * are written once, here, and composed into each query as `sql` fragments.
 */

/**
 * The battles every panel is counted over: one row per battle a player fought
 * in this vehicle, with what they had fitted and how that battle went.
 *
 * Read from `battle_loadouts`, never from the garage (see `loadout-stats` for
 * why), joined to the battle itself for its mode and its winner, and to the
 * player's own entry in it for their damage and their team. The join to that
 * entry is by the battle-scoped vehicle id, which is the key both tables share.
 *
 * Filtered to rows that actually carry a loadout: a recording names the field
 * modifications of everyone who has any, so most rows in the table belong to
 * other players and hold nothing else. `opt_devices` is what only the
 * recording player's row has.
 *
 * The `account_*` figures are the player's overall win rate and ratings,
 * across their whole account: what a row's figures are read against, so a
 * setup is judged against how good the people running it are in general.
 *
 * One mode at a time, never pooled (see `LoadoutMode`). `null` reads every
 * counted mode at once, which only the breakdown of which modes hold anything
 * asks for, and which groups by `battle_type` itself.
 *
 * `LEFT JOIN` on the player rather than an inner one. A battle names accounts
 * we may never have tracked, and dropping those would skew the population
 * towards the players who get looked up. They count, with no account rating,
 * and are left out of the player baselines rather than counted as zero.
 */
export function battlesCte(
  region: Region,
  tankId: number,
  mode: LoadoutMode | null,
): SQL {
  const loadouts = battleLoadoutsByRegion[region];
  const battles = battlesByRegion[region];
  const players = playersByRegion[region];
  const battleTypes = mode
    ? LOADOUT_MODE_BATTLES[mode]
    : LOADOUT_MODES.flatMap((each) => LOADOUT_MODE_BATTLES[each]);
  const modes = sql.join(
    battleTypes.map((type) => sql`${type}`),
    sql`, `,
  );
  return sql`
    SELECT x.*
    FROM (
      SELECT
        l.account_id,
        l.started_at,
        l.arena_unique_id,
        l.opt_devices,
        l.devices_triple,
        l.consumables,
        l.boosters,
        l.crew,
        l.crew_role_skills,
        l.field_mods_packed,
        l.premium_shell_share,
        l.shells_loaded,
        l.shells,
        b.map_name,
        b.battle_type,
        p.id AS player_id,
        p.nickname,
        p.clan_id,
        p.winrate AS account_winrate,
        p.wn7 AS account_wn7,
        p.wn8 AS account_wn8,
        p.wnx AS account_wnx,
        (v.value ->> 'damage')::numeric AS damage,
        COALESCE((v.value ->> 'radio')::numeric, 0)
          + COALESCE((v.value ->> 'track')::numeric, 0) AS assisted,
        COALESCE((v.value ->> 'kills')::int, 0) AS kills,
        COALESCE((v.value ->> 'spotted')::int, 0) AS spotted,
        COALESCE((v.value ->> 'defended')::int, 0) AS defended,
        CASE WHEN (v.value ->> 'team')::int = b.winner_team THEN 1 ELSE 0 END AS win
      FROM ${loadouts} l
      JOIN ${battles} b
        ON b.started_at = l.started_at AND b.arena_unique_id = l.arena_unique_id
      CROSS JOIN LATERAL (
        SELECT value
        FROM jsonb_array_elements(b.vehicles)
        WHERE (value ->> 'id')::bigint = l.vehicle_id
        LIMIT 1
      ) v
      LEFT JOIN ${players} p ON p.account_id = l.account_id
      WHERE l.tank_id = ${tankId}
        AND l.account_id IS NOT NULL
        AND l.opt_devices IS NOT NULL
        AND l.started_at >= now() - make_interval(days => ${LOADOUT_WINDOW_DAYS})
        AND b.battle_type IN (${modes})
    ) x
  `;
}

/**
 * One player's battles under one row, folded to the counters the row's figures
 * are built from. Every aggregate groups by its row AND the account with this
 * first, then rolls the result up with `PERFORMANCE_COLUMNS`, so a row knows
 * how many different people stand behind it and not only how many battles.
 *
 * The account figures are one value per player, so `MAX` only picks it.
 */
export const PER_PLAYER_COLUMNS = sql`
  COUNT(*)            AS b,
  SUM(win)            AS w,
  SUM(damage)         AS d,
  SUM(assisted)       AS a,
  SUM(kills)          AS k,
  SUM(spotted)        AS s,
  SUM(defended)       AS def,
  MAX(account_winrate) AS awr,
  MAX(account_wn7)    AS aw7,
  MAX(account_wn8)    AS aw8,
  MAX(account_wnx)    AS awx
`;

/**
 * A row's totals, from its per-player counters.
 *
 * Totals and not rates, because the ratings are computed from totals: the win
 * rate and the damage are pooled over the battles (with a handful per player, a
 * mean of per-player rates would be a mean of zeroes and ones), and WN8 is a
 * function of the whole record rather than an average of battles. The players'
 * account win rate and ratings are weighted by their battles under this row,
 * over the players we hold them for, so a player behind sixty of the row's
 * battles weighs on its baseline as much as on its figures.
 */
export const PERFORMANCE_COLUMNS = sql`
  COUNT(*)                                                        AS players,
  SUM(b)                                                          AS battles,
  SUM(w)                                                          AS wins,
  SUM(d)                                                          AS damage,
  SUM(a)                                                          AS assisted,
  SUM(k)                                                          AS kills,
  SUM(s)                                                          AS spotted,
  SUM(def)                                                        AS defended,
  SUM(awr * b) / NULLIF(SUM(b) FILTER (WHERE awr IS NOT NULL), 0) AS player_winrate,
  SUM(aw7 * b) / NULLIF(SUM(b) FILTER (WHERE aw7 IS NOT NULL), 0) AS player_wn7,
  SUM(aw8 * b) / NULLIF(SUM(b) FILTER (WHERE aw8 IS NOT NULL), 0) AS player_wn8,
  SUM(awx * b) / NULLIF(SUM(b) FILTER (WHERE awx IS NOT NULL), 0) AS player_wnx
`;

type Numeric = string | number | null;

export type PerformanceRow = {
  players: Numeric;
  battles: Numeric;
  wins: Numeric;
  damage: Numeric;
  assisted: Numeric;
  kills: Numeric;
  spotted: Numeric;
  defended: Numeric;
  player_winrate: Numeric;
  player_wn7: Numeric;
  player_wn8: Numeric;
  player_wnx: Numeric;
};

/** The counters `PER_PLAYER_COLUMNS` produces, for the one family that has to
 * be rolled up in TypeScript (field modifications, which only decode there). */
export type PerPlayerRow = {
  b: Numeric;
  w: Numeric;
  d: Numeric;
  a: Numeric;
  k: Numeric;
  s: Numeric;
  def: Numeric;
  awr: Numeric;
  aw7: Numeric;
  aw8: Numeric;
  awx: Numeric;
};

export const num = (value: string | number | null | undefined): number | null =>
  value == null ? null : Number(value);

/**
 * `PERFORMANCE_COLUMNS`, computed in TypeScript over per-player counters.
 *
 * The same arithmetic, written a second time only because field modifications
 * are packed integers that decode against the vehicle's own tree, which is
 * TypeScript's job. Kept beside the SQL so the two read as one definition.
 */
export function rollUp(rows: PerPlayerRow[]): PerformanceRow {
  const sum = (pick: (row: PerPlayerRow) => Numeric, weighted = false) =>
    rows.reduce(
      (total, row) =>
        total + Number(pick(row) ?? 0) * (weighted ? Number(row.b) : 1),
      0,
    );
  // Battle-weighted over the players we hold that rating for.
  const rated = (pick: (row: PerPlayerRow) => Numeric) => {
    const of = rows.filter((row) => pick(row) != null);
    const battles = of.reduce((total, row) => total + Number(row.b), 0);
    return battles > 0
      ? of.reduce((total, row) => total + Number(pick(row)) * Number(row.b), 0) /
          battles
      : null;
  };
  return {
    players: rows.length,
    battles: sum((row) => row.b),
    wins: sum((row) => row.w),
    damage: sum((row) => row.d),
    assisted: sum((row) => row.a),
    kills: sum((row) => row.k),
    spotted: sum((row) => row.s),
    defended: sum((row) => row.def),
    player_winrate: rated((row) => row.awr),
    player_wn7: rated((row) => row.aw7),
    player_wn8: rated((row) => row.aw8),
    player_wnx: rated((row) => row.awx),
  };
}

/** Summing per-player counters of the same player across two rows of theirs
 * that fall under one item (field modifications, where a player changing one
 * pair still ran the others in both). The averages are the player's own and
 * and ratings do not add. */
export function mergePlayer(held: PerPlayerRow, row: PerPlayerRow): PerPlayerRow {
  const add = (x: Numeric, y: Numeric) => Number(x ?? 0) + Number(y ?? 0);
  return {
    ...held,
    b: add(held.b, row.b),
    w: add(held.w, row.w),
    d: add(held.d, row.d),
    a: add(held.a, row.a),
    k: add(held.k, row.k),
    s: add(held.s, row.s),
    def: add(held.def, row.def),
  };
}

/** What the ratings need about the vehicle: its tier and its expected values,
 * loaded once a request and handed to every row. */
export interface RatingContext {
  tankId: number;
  tier: number | null;
  expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
  encyclopedia: Record<string, VehicleMeta>;
  fallback: Map<string, WN8Expected>;
}

export async function ratingContext(
  region: Region,
  tankId: number,
): Promise<RatingContext> {
  // All memoized for the day, so this costs no network call. A tank with no
  // expected values yet rates null rather than a number nobody could reproduce.
  const [encyclopedia, expected, wnxExpected] = await Promise.all([
    getVehicleEncyclopedia(region).catch(() => ({}) as Record<string, VehicleMeta>),
    getWN8ExpectedValues().catch(() => new Map<number, WN8Expected>()),
    getWNXExpectedValues().catch(() => new Map<number, WNXExpected>()),
  ]);
  return {
    tankId,
    tier: encyclopedia[String(tankId)]?.tier ?? null,
    expected,
    wnxExpected,
    encyclopedia,
    fallback: buildWN8Fallback(expected, encyclopedia),
  };
}

export type Totals = {
  battles: number;
  wins: number;
  damage: number;
  assisted: number;
  kills: number;
  spotted: number;
  defended: number;
};

/**
 * All three ratings over a set of battle totals, with the site's own formulas,
 * so the table follows whichever metric the reader picked in the navbar.
 */
export function ratingsOf(context: RatingContext, totals: Totals): LoadoutRatings {
  if (totals.battles <= 0) {
    return { [RatingMetric.Wn7]: null, [RatingMetric.Wn8]: null, [RatingMetric.Wnx]: null };
  }
  const stats: TankStats = {
    tank_id: context.tankId,
    mark_of_mastery: null,
    marks_on_gun: null,
    all: {
      battles: totals.battles,
      wins: totals.wins,
      damage_dealt: totals.damage,
      spotted: totals.spotted,
      frags: totals.kills,
      dropped_capture_points: totals.defended,
      // WNX reads the assist as one figure; the split does not matter to it.
      radio_assisted_damage: totals.assisted,
      track_assisted_damage: 0,
      xp: 0,
    },
  };
  return {
    [RatingMetric.Wn7]: computeWN7(
      {
        battles: totals.battles,
        wins: totals.wins,
        frags: totals.kills,
        damageDealt: totals.damage,
        spotted: totals.spotted,
        droppedCapturePoints: totals.defended,
      },
      context.tier,
    ),
    [RatingMetric.Wn8]: computeWN8(
      [stats],
      context.expected,
      context.encyclopedia,
      context.fallback,
    ),
    [RatingMetric.Wnx]: computeWNX([stats], context.wnxExpected),
  };
}

/**
 * The figures of one row, at any size.
 *
 * Returned from the first battle: the table shows every row's figures, and the
 * page marks the ones too few players stand behind (`MIN_ROW_PERFORMANCE_SAMPLE`)
 * rather than hiding them, so a reader sees the numbers and how much they rest
 * on at the same glance.
 */
export function performanceOf(
  row: PerformanceRow,
  context: RatingContext,
): LoadoutPerformance {
  const n = (value: Numeric) => Number(value ?? 0);
  const battles = n(row.battles);
  const rate = (value: Numeric) => (battles > 0 ? n(value) / battles : null);
  return {
    players: n(row.players),
    battles,
    winrate: rate(row.wins),
    playerWinrate: row.player_winrate == null ? null : n(row.player_winrate),
    avgDamage: rate(row.damage),
    avgAssist: rate(row.assisted),
    rating: ratingsOf(context, {
      battles,
      wins: n(row.wins),
      damage: n(row.damage),
      assisted: n(row.assisted),
      kills: n(row.kills),
      spotted: n(row.spotted),
      defended: n(row.defended),
    }),
    playerRating: {
      [RatingMetric.Wn7]: row.player_wn7 == null ? null : n(row.player_wn7),
      [RatingMetric.Wn8]: row.player_wn8 == null ? null : n(row.player_wn8),
      [RatingMetric.Wnx]: row.player_wnx == null ? null : n(row.player_wnx),
    },
  };
}
