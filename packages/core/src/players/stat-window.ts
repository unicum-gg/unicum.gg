import { sql } from "drizzle-orm";
import {
  StatWindowUnit,
  buildPeriodDerived,
  playerSnapshotsByRegion,
  playersByRegion,
  tankSnapshotsByRegion,
  type PlayerSnapshot,
  type PlayerStatWindow,
  type StatWindow,
  type Stats,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { traced } from "@unicum.gg/core/lib/perf-trace";
import { diffStats, statsFromSnapshot } from "@unicum.gg/core/players";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import {
  type RawPlayerSnapshot,
  type RawTankSnapshot,
  snapshotFromRaw,
  tankSnapshotFromRaw,
  tankSnapshotMapFromRaws,
} from "./initial-data";
import { tankPeriod } from "./tank-periods";
import { tankSnapshotsToTankStats } from "./tanks";

/**
 * The account's own diff over a window, kept for the two figures only the
 * account carries (PR and WTR). An empty first fetch (battles === 0, the
 * poisoned snapshot where WG's aggregate lagged) means the whole window is
 * "everything since we started tracking", so its ratings are the lifetime
 * ones: that baseline carried a non-zero wtr even with battles 0, and a naive
 * diff showed a fraction of the real change.
 */
export function accountPeriodDiff(
  latest: PlayerSnapshot,
  baseline: PlayerSnapshot | null,
): Stats | null {
  if (!baseline) return null;
  const current = statsFromSnapshot(latest);
  if (baseline.battles === 0) return current;
  return diffStats(current, statsFromSnapshot(baseline));
}

// The exact columns tankSnapshotFromRaw consumes; keep in sync with it and
// with the profile's own read in `loadPlayerInitialData`.
const TANK_COLS = sql`
  player_id, tank_id, taken_at, battles, wins, damage_dealt, spotted, frags,
  dropped_capture_points, radio_assisted_damage, track_assisted_damage, xp,
  mark_of_mastery, marks_on_gun, mark_percent, survived_battles, hits,
  shots, capture_points, draws`;

/**
 * The instant a window starts at, as SQL over `tank_rows`.
 *
 * Days are a clock. Battles are counted on the VEHICLE side, the side every
 * counter of the column is diffed from: a vehicle's row is only written when
 * its counters moved, so each row adds `battles - previous battles` to the
 * account, and the running sum of those increments in time order is the
 * account's battle count at every instant we hold. The window starts at the
 * latest instant that sat at least N battles below the newest one. Null when
 * no instant did, which is a window reaching past our history.
 *
 * It is only as fine as our snapshots: a session read in one go cannot be cut
 * in the middle, so a 1000-battle column lands on the nearest instant at or
 * beyond 1000 and says how many battles it actually holds.
 */
function windowStart(window: StatWindow) {
  if (window.unit === StatWindowUnit.Days) {
    return sql`(SELECT NOW() - make_interval(days => ${window.value}))`;
  }
  return sql`(
    WITH increments AS (
      SELECT taken_at,
        battles - COALESCE(
          lag(battles) OVER (PARTITION BY tank_id ORDER BY taken_at, battles),
          0
        ) AS inc
      FROM tank_rows
    ),
    running AS (
      SELECT taken_at, sum(inc) OVER (ORDER BY taken_at) AS total
      FROM increments
    )
    SELECT max(taken_at) FROM running
    WHERE total <= (SELECT max(total) FROM running) - ${window.value}
  )`;
}

type Row = {
  account_id: number | null;
  nickname: string | null;
  start_at: string | null;
  first_at: string | null;
  latest_snapshot: RawPlayerSnapshot | null;
  baseline_snapshot: RawPlayerSnapshot | null;
  latest_tanks: RawTankSnapshot[] | null;
  baseline_tanks: RawTankSnapshot[] | null;
};

/**
 * One column of the profile's stats table over a window the reader chose.
 *
 * Exactly the rule the 24h/7d/30d columns follow (see `loadPlayerInitialData`
 * for why): per vehicle, the newest row at or before the window's start, or
 * the account's first fetch when we have held it for less than the window, and
 * a vehicle with no such row is one first played inside it. The only new part
 * is where the window starts, see `windowStart`.
 *
 * Reads the database alone: by the time a reader can ask for a custom column,
 * the profile has loaded and written the account back. Null when the account
 * is unknown or has never been snapshotted.
 */
export async function loadPlayerStatWindow(
  region: Region,
  nickname: string,
  window: StatWindow,
): Promise<(PlayerStatWindow & { accountId: number; nickname: string }) | null> {
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];
  const tankSnapshots = tankSnapshotsByRegion[region];

  // COALESCE because a null start (a battle window past our history) must
  // read as "not a baseline" rather than as NULL, which sorts FIRST under
  // DESC and would pick an arbitrary row.
  const inBase = sql`COALESCE(
      taken_at <= (SELECT at FROM win) OR taken_at <= first_at + interval '1 minute',
      false
    )`;

  const rows = (await traced("db loadPlayerStatWindow", () =>
    db.execute(sql`
      WITH p AS (
        SELECT id, account_id, nickname FROM ${players}
        WHERE LOWER(nickname) = LOWER(${nickname})
        LIMIT 1
      ),
      tank_rows AS (
        SELECT ${TANK_COLS}, min(taken_at) OVER () AS first_at
        FROM ${tankSnapshots}
        WHERE player_id = (SELECT id FROM p)
      ),
      win AS (SELECT ${windowStart(window)} AS at),
      tank_scan AS (
        SELECT ${TANK_COLS}, first_at,
          row_number() OVER (PARTITION BY tank_id ORDER BY taken_at DESC, battles DESC) AS rn_latest,
          row_number() OVER (
            PARTITION BY tank_id ORDER BY ${inBase} DESC, taken_at DESC, battles DESC
          ) AS rn_base,
          ${inBase} AS in_base
        FROM tank_rows
      ),
      latest_snap AS (
        SELECT * FROM ${playerSnapshots}
        WHERE player_id = (SELECT id FROM p)
        ORDER BY taken_at DESC, id DESC
        LIMIT 1
      ),
      baseline_snap AS (
        SELECT * FROM ${playerSnapshots}
        WHERE player_id = (SELECT id FROM p)
        ORDER BY
          COALESCE(taken_at <= (SELECT at FROM win), false) DESC,
          CASE WHEN taken_at <= (SELECT at FROM win) THEN taken_at END DESC,
          taken_at ASC
        LIMIT 1
      )
      SELECT
        (SELECT account_id FROM p) AS account_id,
        (SELECT nickname FROM p) AS nickname,
        (SELECT at FROM win) AS start_at,
        (SELECT min(first_at) FROM tank_rows) AS first_at,
        (SELECT row_to_json(latest_snap.*) FROM latest_snap) AS latest_snapshot,
        (SELECT row_to_json(baseline_snap.*) FROM baseline_snap) AS baseline_snapshot,
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT ${TANK_COLS} FROM tank_scan WHERE rn_latest = 1
        ) t) AS latest_tanks,
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT ${TANK_COLS} FROM tank_scan WHERE rn_base = 1 AND in_base
        ) t) AS baseline_tanks
    `),
  )) as unknown as Row[];

  const row = rows[0];
  if (!row?.account_id || !row.nickname || !row.latest_snapshot) return null;

  const [encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
  ]);

  const latest = snapshotFromRaw(row.latest_snapshot);
  const baseline = row.baseline_snapshot ? snapshotFromRaw(row.baseline_snapshot) : null;
  const tanks = tankSnapshotsToTankStats((row.latest_tanks ?? []).map(tankSnapshotFromRaw));
  const period = tankPeriod(
    tanks,
    tankSnapshotMapFromRaws(row.baseline_tanks),
    accountPeriodDiff(latest, baseline),
  );

  const startAt = row.start_at ? new Date(row.start_at) : null;
  const firstAt = row.first_at ? new Date(row.first_at) : null;
  // The window reaches past our history when it has no start at all (more
  // battles than we ever saw) or starts before the first fetch closed.
  const truncated =
    firstAt !== null &&
    (startAt === null || startAt.getTime() <= firstAt.getTime() + 60_000);

  return {
    accountId: Number(row.account_id),
    nickname: row.nickname,
    window,
    stats: period?.stats ?? null,
    derived: buildPeriodDerived(
      period?.stats ?? null,
      period?.tanks ?? null,
      encyclopedia,
      wn8Expected,
      wnxExpected,
    ),
    from: truncated ? firstAt : startAt,
    truncated,
  };
}
