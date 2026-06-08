import { asc, eq } from "drizzle-orm";
import { RatingMetric } from "@/constants/rating";
import { db } from "@/services/db";
import { tankSnapshotsByRegion } from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";
import {
  computeAvgTier,
  getVehicleEncyclopedia,
} from "@/services/wargaming/wot/encyclopedia";
import {
  type WN8Expected,
  type WNXExpected,
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";
import type { TankStats } from "@/services/wargaming/wot/tanks";

export type RatingHistoryPoint = {
  day: string;
  value: number | null;
};

export type RatingHistory = {
  windowDays: number;
  points: RatingHistoryPoint[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_DAYS = 30;
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
 * Daily rolling rating series. The window adapts to the data we have: it
 * stays at 30 days once the player has 30+ days of snapshots, and shrinks
 * down to whatever's available before that (so a player tracked 11 days
 * still gets a line, computed over an 11-day window). Returns an empty
 * point list when there's less than one day of data spread.
 */
export async function getRatingHistory(
  region: Region,
  playerId: number,
  metric: RatingMetric,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
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
    .where(eq(tankSnapshots.playerId, playerId))
    .orderBy(asc(tankSnapshots.takenAt), asc(tankSnapshots.id));

  if (rows.length === 0) return { windowDays: 0, points: [] };

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
  const daysOfData = Math.floor((endDay - oldestDay) / DAY_MS);
  if (daysOfData < 1) return { windowDays: 0, points: [] };

  // The "advertised" window: the largest window we'll ever use, capped at 30
  // days. Each anchor day uses its own actual window = min(30d, days back to
  // the oldest snapshot), so early anchors get a shorter window while late
  // anchors (once we've accumulated 30+ days) get the full 30. This keeps
  // every anchor producing a point instead of waiting 30 days for the first.
  const windowDays = Math.min(MAX_WINDOW_DAYS, daysOfData);

  const lookbackStart = endDay - lookbackDays * DAY_MS;
  const startDay = Math.max(oldestDay + DAY_MS, lookbackStart);
  if (startDay > endDay) return { windowDays, points: [] };

  const [encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
  ]);
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);

  const points: RatingHistoryPoint[] = [];
  for (let dayMs = startDay; dayMs <= endDay; dayMs += DAY_MS) {
    const currentMs = dayMs + DAY_MS - 1;
    const priorMs = Math.max(
      currentMs - MAX_WINDOW_DAYS * DAY_MS,
      oldestMs,
    );

    const currentTanks: TankStats[] = [];
    const priorByTank = new Map<number, TankStats>();
    for (const [tankId, snaps] of byTank) {
      const cur = findLatestAtOrBefore(snaps, currentMs);
      const prior = findLatestAtOrBefore(snaps, priorMs);
      if (!cur) continue;
      currentTanks.push(rowToTankStats(cur));
      if (prior) priorByTank.set(tankId, rowToTankStats(prior));
    }

    const delta = diffTankStats(currentTanks, priorByTank);
    const value = computeMetric(
      metric,
      delta,
      encyclopedia,
      wn8Expected,
      wn8Fallback,
      wnxExpected,
    );
    points.push({ day: dayToISO(dayMs), value });
  }
  return { windowDays, points };
}

function diffTankStats(
  current: TankStats[],
  prior: Map<number, TankStats>,
): TankStats[] {
  const out: TankStats[] = [];
  for (const t of current) {
    const p = prior.get(t.tank_id);
    if (!p) continue;
    const battlesDiff = t.all.battles - p.all.battles;
    if (battlesDiff <= 0) continue;
    out.push({
      tank_id: t.tank_id,
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
      },
    });
  }
  return out;
}

function computeMetric(
  metric: RatingMetric,
  delta: TankStats[],
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>,
  wn8Expected: Map<number, WN8Expected>,
  wn8Fallback: ReturnType<typeof buildWN8Fallback>,
  wnxExpected: Map<number, WNXExpected>,
): number | null {
  if (delta.length === 0) return null;
  if (metric === RatingMetric.Wn8) {
    return computeWN8(delta, wn8Expected, encyclopedia, wn8Fallback);
  }
  if (metric === RatingMetric.Wnx) {
    return computeWNX(delta, wnxExpected);
  }
  const agg = delta.reduce(
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
  const avgTier = computeAvgTier(delta, encyclopedia);
  return computeWN7(agg, avgTier);
}

function rowToTankStats(s: TankSnapshotRow): TankStats {
  return {
    tank_id: s.tankId,
    all: {
      battles: s.battles,
      wins: s.wins,
      damage_dealt: s.damageDealt,
      spotted: s.spotted,
      frags: s.frags,
      dropped_capture_points: s.droppedCapturePoints,
      radio_assisted_damage: s.radioAssistedDamage,
      track_assisted_damage: s.trackAssistedDamage,
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
