import { and, asc, eq } from "drizzle-orm";
import { RatingMetric, tankSnapshotsByRegion, computeAvgTier, type WN8Expected, type WNXExpected, buildWN8Fallback, computeWN7, computeWN8, computeWNX, type RatingHistory, type RatingHistoryPoint, type RatingHistoryMetricValues } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import type { Region } from "@unicum.gg/wargaming";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";

// Client-safe shapes live in `@unicum.gg/shared`; re-exported for back-compat.
export type { RatingHistory, RatingHistoryPoint };

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 90;

type TankSnapshotRow = {
  tankId: number;
  takenAt: Date;
  battles: number;
  wins: number;
  damageDealt: number;
  spotted: number;
  frags: number;
  droppedCapturePoints: number;
  radioAssistedDamage: number;
  trackAssistedDamage: number;
};

/**
 * Two parallel daily series:
 *
 *   - `lifetime`: WN8/WN7/WNX computed on the player's cumulative tank
 *     stats at-or-before that day. Matches the value in the stats table's
 *     `Total` column. Smooth, slow drift.
 *   - `session`: WN8/WN7/WNX computed on the delta between this anchor's
 *     tank state and the previous anchor's tank state. Spiky, reflects
 *     each day's actual session performance. null on the very first day
 *     (no prior) and on days with no battle change.
 */
export async function getRatingHistory(
  region: Region,
  playerId: number,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  /** Narrow the series to one vehicle: the same two curves, read as "how did
   * this player get on with this tank". Cheaper than the whole player, since
   * `(player_id, tank_id)` is the primary key's prefix. */
  tankId?: number,
): Promise<RatingHistory> {
  const tankSnapshots = tankSnapshotsByRegion[region];

  const rows: TankSnapshotRow[] = await db
    .select({
      tankId: tankSnapshots.tankId,
      takenAt: tankSnapshots.takenAt,
      battles: tankSnapshots.battles,
      wins: tankSnapshots.wins,
      damageDealt: tankSnapshots.damageDealt,
      spotted: tankSnapshots.spotted,
      frags: tankSnapshots.frags,
      droppedCapturePoints: tankSnapshots.droppedCapturePoints,
      radioAssistedDamage: tankSnapshots.radioAssistedDamage,
      trackAssistedDamage: tankSnapshots.trackAssistedDamage,
    })
    .from(tankSnapshots)
    .where(
      tankId === undefined
        ? eq(tankSnapshots.playerId, playerId)
        : and(
            eq(tankSnapshots.playerId, playerId),
            eq(tankSnapshots.tankId, tankId),
          ),
    )
    // Same-`taken_at` tie-break on battles (monotonic per tank), so a chunk
    // written under one `now()` still replays in the order it happened.
    .orderBy(asc(tankSnapshots.takenAt), asc(tankSnapshots.battles));

  if (rows.length === 0) return { points: [] };

  const byTank = new Map<number, TankSnapshotRow[]>();
  for (const r of rows) {
    const arr = byTank.get(r.tankId);
    if (arr) arr.push(r);
    else byTank.set(r.tankId, [r]);
  }

  const oldestMs = rows[0].takenAt.getTime();
  const newestMs = rows[rows.length - 1].takenAt.getTime();
  const endDay = startOfDay(newestMs);
  const oldestDay = startOfDay(oldestMs);
  const lookbackStart = endDay - lookbackDays * DAY_MS;
  const startDay = Math.max(oldestDay, lookbackStart);
  if (startDay > endDay) return { points: [] };

  const [encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
  ]);
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);

  const points: RatingHistoryPoint[] = [];
  let prevCumulative: Map<number, TankStats> | null = null;

  for (let dayMs = startDay; dayMs <= endDay; dayMs += DAY_MS) {
    const currentMs = dayMs + DAY_MS - 1;
    const currentCumulative = new Map<number, TankStats>();
    for (const [tankId, snaps] of byTank) {
      const cur = findLatestAtOrBefore(snaps, currentMs);
      if (cur) currentCumulative.set(tankId, rowToTankStats(cur));
    }
    const currentTanks = Array.from(currentCumulative.values());

    const lifetime = computeAllMetrics(
      currentTanks,
      encyclopedia,
      wn8Expected,
      wn8Fallback,
      wnxExpected,
    );

    let session: RatingHistoryMetricValues = {
      wn7: null,
      wn8: null,
      wnx: null,
    };
    if (prevCumulative !== null) {
      const sessionDelta: TankStats[] = [];
      for (const t of currentTanks) {
        const p = prevCumulative.get(t.tank_id);
        if (!p) {
          // Tank that didn't exist in the previous snapshot — count its
          // full current stats as "earned this session" (the player
          // acquired and played it inside the window).
          if (t.all.battles > 0) sessionDelta.push(t);
          continue;
        }
        const battlesDiff = t.all.battles - p.all.battles;
        if (battlesDiff <= 0) continue;
        sessionDelta.push({
          tank_id: t.tank_id,
          mark_of_mastery: null,
          all: {
            battles: battlesDiff,
            wins: t.all.wins - p.all.wins,
            damage_dealt: t.all.damage_dealt - p.all.damage_dealt,
            spotted: t.all.spotted - p.all.spotted,
            frags: t.all.frags - p.all.frags,
            dropped_capture_points:
              t.all.dropped_capture_points - p.all.dropped_capture_points,
            radio_assisted_damage:
              t.all.radio_assisted_damage - p.all.radio_assisted_damage,
            track_assisted_damage:
              t.all.track_assisted_damage - p.all.track_assisted_damage,
            xp: t.all.xp - p.all.xp,
          },
        });
      }
      session = computeAllMetrics(
        sessionDelta,
        encyclopedia,
        wn8Expected,
        wn8Fallback,
        wnxExpected,
      );
    }

    points.push({ day: dayToISO(dayMs), lifetime, session });
    prevCumulative = currentCumulative;
  }
  return { points };
}

// All three metrics from one tank set (the DB scan + day bucketing is the
// expensive part and shared; computing three ratings per day instead of one is
// cheap in-memory, and makes the payload metric-agnostic / cacheable).
function computeAllMetrics(
  tanks: TankStats[],
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>,
  wn8Expected: Map<number, WN8Expected>,
  wn8Fallback: ReturnType<typeof buildWN8Fallback>,
  wnxExpected: Map<number, WNXExpected>,
): RatingHistoryMetricValues {
  return {
    wn7: computeMetric(RatingMetric.Wn7, tanks, encyclopedia, wn8Expected, wn8Fallback, wnxExpected),
    wn8: computeMetric(RatingMetric.Wn8, tanks, encyclopedia, wn8Expected, wn8Fallback, wnxExpected),
    wnx: computeMetric(RatingMetric.Wnx, tanks, encyclopedia, wn8Expected, wn8Fallback, wnxExpected),
  };
}

function computeMetric(
  metric: RatingMetric,
  tanks: TankStats[],
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>,
  wn8Expected: Map<number, WN8Expected>,
  wn8Fallback: ReturnType<typeof buildWN8Fallback>,
  wnxExpected: Map<number, WNXExpected>,
): number | null {
  if (tanks.length === 0) return null;
  if (metric === RatingMetric.Wn8) {
    return computeWN8(tanks, wn8Expected, encyclopedia, wn8Fallback);
  }
  if (metric === RatingMetric.Wnx) {
    return computeWNX(tanks, wnxExpected);
  }
  const agg = tanks.reduce(
    (acc, t) => {
      acc.battles += t.all.battles;
      acc.wins += t.all.wins;
      acc.frags += t.all.frags;
      acc.damageDealt += t.all.damage_dealt;
      acc.spotted += t.all.spotted;
      acc.droppedCapturePoints += t.all.dropped_capture_points;
      return acc;
    },
    {
      battles: 0,
      wins: 0,
      frags: 0,
      damageDealt: 0,
      spotted: 0,
      droppedCapturePoints: 0,
    },
  );
  if (agg.battles === 0) return null;
  const avgTier = computeAvgTier(tanks, encyclopedia);
  return computeWN7(agg, avgTier);
}

function rowToTankStats(s: TankSnapshotRow): TankStats {
  return {
    tank_id: s.tankId,
    mark_of_mastery: null,
    all: {
      battles: s.battles,
      wins: s.wins,
      damage_dealt: s.damageDealt,
      spotted: s.spotted,
      frags: s.frags,
      dropped_capture_points: s.droppedCapturePoints,
      radio_assisted_damage: s.radioAssistedDamage,
      track_assisted_damage: s.trackAssistedDamage,
      xp: 0,
    },
  };
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function dayToISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function findLatestAtOrBefore<T extends { takenAt: Date }>(
  sortedAsc: T[],
  ms: number,
): T | null {
  let lo = 0;
  let hi = sortedAsc.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAsc[mid].takenAt.getTime() <= ms) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans === -1 ? null : sortedAsc[ans];
}
