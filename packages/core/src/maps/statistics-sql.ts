import { sql, type SQL } from "drizzle-orm";
import {
  battlesByRegion,
  LOADOUT_MODE_BATTLES,
  LOADOUT_MODES,
  LOADOUT_WINDOW_DAYS,
  type LoadoutMode,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * The scaffolding the map statistics are built on, written once so the map's
 * own figures and the every-map baseline they are read against are counted
 * over exactly the same kind of record.
 */

/** The `bonusType` values of one mode, or of every counted mode for `null`. */
export function battleTypesOf(mode: LoadoutMode | null): SQL {
  const types = mode
    ? LOADOUT_MODE_BATTLES[mode]
    : LOADOUT_MODES.flatMap((each) => LOADOUT_MODE_BATTLES[each]);
  return sql.join(
    types.map((type) => sql`${type}`),
    sql`, `,
  );
}

/**
 * One row per vehicle record: one account's part in one battle, with the
 * counters every figure is built from.
 *
 * Unnested from the battle's own `vehicles` document, which is the whole
 * roster as the results report it. Bots carry no account and are dropped:
 * they are not players, and a map where bots fill a side would otherwise read
 * as one where heavies die early.
 *
 * `arenas` is null for the baseline, which reads every map of the mode.
 */
export function recordsCte(
  region: Region,
  arenas: string[] | null,
  mode: LoadoutMode | null,
): SQL {
  const battles = battlesByRegion[region];
  const onMap = arenas
    ? sql`AND b.map_name IN (${sql.join(
        arenas.map((arena) => sql`${arena}`),
        sql`, `,
      )})`
    : sql``;
  return sql`
    SELECT
      b.battle_type,
      b.started_at,
      b.arena_unique_id,
      (v.value ->> 'account')::bigint AS account_id,
      (v.value ->> 'tank')::int AS tank_id,
      COALESCE((v.value ->> 'damage')::numeric, 0) AS damage,
      COALESCE((v.value ->> 'radio')::numeric, 0)
        + COALESCE((v.value ->> 'track')::numeric, 0) AS assisted,
      COALESCE((v.value ->> 'kills')::int, 0) AS kills,
      COALESCE((v.value ->> 'spotted')::int, 0) AS spotted,
      COALESCE((v.value ->> 'defended')::int, 0) AS defended,
      COALESCE((v.value ->> 'xp')::int, 0) AS xp,
      -- -1 is the game's own "survived"; any other reason is a death.
      CASE WHEN (v.value ->> 'deathReason')::int = -1 THEN 1 ELSE 0 END AS survived,
      CASE WHEN (v.value ->> 'team')::int = b.winner_team THEN 1 ELSE 0 END AS win
    FROM ${battles} b
    CROSS JOIN LATERAL jsonb_array_elements(b.vehicles) v
    WHERE b.started_at >= now() - make_interval(days => ${LOADOUT_WINDOW_DAYS})
      AND b.battle_type IN (${battleTypesOf(mode)})
      AND v.value ? 'account'
      ${onMap}
  `;
}

/** The totals every row is rolled up to. */
export const RECORD_COLUMNS = sql`
  COUNT(DISTINCT account_id) AS players,
  COUNT(*)                   AS records,
  SUM(win)                   AS wins,
  SUM(damage)                AS damage,
  SUM(assisted)              AS assisted,
  SUM(kills)                 AS kills,
  SUM(spotted)               AS spotted,
  SUM(defended)              AS defended,
  SUM(survived)              AS survived,
  SUM(xp)                    AS xp
`;

type Numeric = string | number | null;

export type RecordRow = {
  players: Numeric;
  records: Numeric;
  wins: Numeric;
  damage: Numeric;
  assisted: Numeric;
  kills: Numeric;
  spotted: Numeric;
  defended: Numeric;
  survived: Numeric;
  xp: Numeric;
};

/** A row's totals as numbers. */
export type RecordTotals = {
  players: number;
  records: number;
  wins: number;
  damage: number;
  assisted: number;
  kills: number;
  spotted: number;
  defended: number;
  survived: number;
  xp: number;
};

export function totalsOf(row: RecordRow): RecordTotals {
  const n = (value: Numeric) => Number(value ?? 0);
  return {
    players: n(row.players),
    records: n(row.records),
    wins: n(row.wins),
    damage: n(row.damage),
    assisted: n(row.assisted),
    kills: n(row.kills),
    spotted: n(row.spotted),
    defended: n(row.defended),
    survived: n(row.survived),
    xp: n(row.xp),
  };
}
