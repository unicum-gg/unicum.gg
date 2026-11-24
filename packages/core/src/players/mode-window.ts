import { sql } from "drizzle-orm";
import {
  StatWindowMode,
  StatWindowUnit,
  playerSnapshotsByRegion,
  playersByRegion,
  type PlayerModeStatWindow,
  type PlayerSnapshot,
  type StatWindow,
  type StrongholdStats,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { traced } from "@unicum.gg/core/lib/perf-trace";
import {
  cwAbsoluteStatsFromSnapshot,
  cwChampionStatsFromSnapshot,
  cwMiddleStatsFromSnapshot,
  diffStrongholdStats,
  epicStatsFromSnapshot,
  falloutStatsFromSnapshot,
  fortifiedStatsFromSnapshot,
  rankedStatsFromSnapshot,
  skirmishStatsFromSnapshot,
} from "@unicum.gg/core/players";
import { type RawPlayerSnapshot, snapshotFromRaw } from "./initial-data";

type ModeSource = {
  fromSnap: (s: PlayerSnapshot) => StrongholdStats | null;
  /** The mode's total experience, which the period average is built from
   * (see `diffStrongholdStats`). */
  xp: (s: PlayerSnapshot) => number | null | undefined;
  /** The snapshot column counting the mode's battles. */
  battlesColumn: string;
};

/** Where each mode lives on a player snapshot, as the profile reads it in
 * `buildPlayerDetail`. */
const MODE_SOURCES: Record<StatWindowMode, ModeSource> = {
  [StatWindowMode.Skirmish]: {
    fromSnap: skirmishStatsFromSnapshot,
    xp: (s) => s.skirmishXp,
    battlesColumn: "skirmish_battles",
  },
  [StatWindowMode.Advances]: {
    fromSnap: fortifiedStatsFromSnapshot,
    xp: (s) => s.fortifiedXp,
    battlesColumn: "fortified_battles",
  },
  [StatWindowMode.GrandBattles]: {
    fromSnap: epicStatsFromSnapshot,
    xp: (s) => s.epicXp,
    battlesColumn: "epic_battles",
  },
  [StatWindowMode.Ranked]: {
    fromSnap: rankedStatsFromSnapshot,
    xp: (s) => s.rankedXp,
    battlesColumn: "ranked_battles",
  },
  [StatWindowMode.Rampage]: {
    fromSnap: falloutStatsFromSnapshot,
    xp: (s) => s.falloutXp,
    battlesColumn: "fallout_battles",
  },
  [StatWindowMode.ClanWarsX]: {
    fromSnap: cwAbsoluteStatsFromSnapshot,
    xp: (s) => s.cwAbsoluteXp,
    battlesColumn: "cw_absolute_battles",
  },
  [StatWindowMode.ClanWarsVIII]: {
    fromSnap: cwChampionStatsFromSnapshot,
    xp: (s) => s.cwChampionXp,
    battlesColumn: "cw_champion_battles",
  },
  [StatWindowMode.ClanWarsVI]: {
    fromSnap: cwMiddleStatsFromSnapshot,
    xp: (s) => s.cwMiddleXp,
    battlesColumn: "cw_middle_battles",
  },
};

type Row = {
  account_id: number | null;
  start_at: string | null;
  first_at: string | null;
  latest_snapshot: RawPlayerSnapshot | null;
  baseline_snapshot: RawPlayerSnapshot | null;
};

/**
 * One period column of a mode tab (Skirmish, Advances, the Clan Wars tiers...)
 * over a window the reader chose.
 *
 * Wargaming splits these modes per vehicle only partly and the profile has
 * always read them off the account snapshots, so this does too: the baseline
 * is the newest snapshot at or before the window's start, or the oldest one
 * we hold when the window reaches past our history, exactly the rule of the
 * 24h/7d/30d columns. A battle window starts at the latest snapshot whose
 * count for THAT mode sat at least N below the newest one, so "the last 200
 * Skirmishes" are Skirmishes, not 200 battles of anything.
 */
export async function loadPlayerModeWindow(
  region: Region,
  nickname: string,
  mode: StatWindowMode,
  window: StatWindow,
): Promise<(PlayerModeStatWindow & { accountId: number }) | null> {
  const players = playersByRegion[region];
  const snapshots = playerSnapshotsByRegion[region];
  const source = MODE_SOURCES[mode];
  const battles = sql.identifier(source.battlesColumn);

  const start =
    window.unit === StatWindowUnit.Days
      ? sql`NOW() - make_interval(days => ${window.value})`
      : sql`(
          SELECT max(taken_at) FROM ${snapshots}
          WHERE player_id = (SELECT id FROM p)
            AND ${battles} <= (SELECT ${battles} FROM latest) - ${window.value}
        )`;

  const rows = (await traced("db loadPlayerModeWindow", () =>
    db.execute(sql`
      WITH p AS (
        SELECT id, account_id FROM ${players}
        WHERE LOWER(nickname) = LOWER(${nickname})
        LIMIT 1
      ),
      latest AS (
        SELECT * FROM ${snapshots}
        WHERE player_id = (SELECT id FROM p)
        ORDER BY taken_at DESC, id DESC
        LIMIT 1
      ),
      win AS (SELECT ${start} AS at),
      -- Only snapshots carrying the mode's counters can be diffed: the first
      -- fetch of an account can predate them, and falling back onto it would
      -- dash a window that our later history could answer.
      baseline AS (
        SELECT * FROM ${snapshots}
        WHERE player_id = (SELECT id FROM p) AND ${battles} IS NOT NULL
        ORDER BY
          COALESCE(taken_at <= (SELECT at FROM win), false) DESC,
          CASE WHEN taken_at <= (SELECT at FROM win) THEN taken_at END DESC,
          taken_at ASC
        LIMIT 1
      )
      SELECT
        (SELECT account_id FROM p) AS account_id,
        (SELECT at FROM win) AS start_at,
        (SELECT min(taken_at) FROM ${snapshots}
         WHERE player_id = (SELECT id FROM p) AND ${battles} IS NOT NULL) AS first_at,
        (SELECT row_to_json(latest.*) FROM latest) AS latest_snapshot,
        (SELECT row_to_json(baseline.*) FROM baseline) AS baseline_snapshot
    `),
  )) as unknown as Row[];

  const row = rows[0];
  if (!row?.account_id || !row.latest_snapshot) return null;

  const latest = snapshotFromRaw(row.latest_snapshot);
  const baseline = row.baseline_snapshot ? snapshotFromRaw(row.baseline_snapshot) : null;
  const current = source.fromSnap(latest);
  const past = baseline ? source.fromSnap(baseline) : null;
  const stats =
    current && past && baseline
      ? diffStrongholdStats(current, past, {
          curr: source.xp(latest),
          prev: source.xp(baseline),
        })
      : null;

  const startAt = row.start_at ? new Date(row.start_at) : null;
  const firstAt = row.first_at ? new Date(row.first_at) : null;
  const truncated =
    firstAt !== null && (startAt === null || startAt.getTime() <= firstAt.getTime());

  return {
    accountId: Number(row.account_id),
    mode,
    window,
    stats,
    from: truncated ? firstAt : startAt,
    truncated,
  };
}
