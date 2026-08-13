import { computeAvgTier, type VehicleMeta } from "../wot/tanks/meta";
import { buildTankSlugIndex } from "../wot/tanks/slug";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "../wot/ratings";
import type { TankStats } from "../wot/tank-stats";

/** How sessions are bucketed. The game has no notion of a session, so this is
 * how far apart two battles have to be before they stop being the same one. */
export enum SessionGranularity {
  Daily = "daily",
  Weekly = "weekly",
  Monthly = "monthly",
}

/**
 * What one vehicle gained between two consecutive snapshots of it.
 *
 * Produced by the reader, which is the only part that knows about the snapshot
 * table, and attributed to the moment we observed it (`takenAtMs`, the later of
 * the two snapshots). A delta spanning several days therefore lands entirely on
 * the day it surfaced: we know a player fought those battles by then, never on
 * which evening. The snapshot cadence follows how much someone plays, so an
 * active account is sampled several times a day and the attribution is exact
 * where it matters.
 */
export type SessionDelta = {
  tankId: number;
  takenAtMs: number;
  battles: number;
  wins: number;
  damageDealt: number;
  /** Null on snapshots written before the column existed, so the damage ratio
   * is missing rather than wrong for those. */
  damageReceived: number | null;
  spotted: number;
  frags: number;
  droppedCapturePoints: number;
  survivedBattles: number | null;
  xp: number | null;
  radioAssistedDamage: number;
  trackAssistedDamage: number;
};

/** The per-battle picture of a set of battles: one session, or one vehicle
 * inside it. Every field is an average or a ratio, so the two read the same. */
export type SessionStats = {
  battles: number;
  winrate: number;
  avgDamage: number;
  avgFrags: number;
  avgSpotted: number;
  avgDefense: number;
  avgAssist: number;
  avgXp: number | null;
  survivalRate: number | null;
  /** Frags over deaths. Null when nothing died (an unbeaten session) or when we
   * do not hold the survival counter for these snapshots. */
  kd: number | null;
  /** Damage dealt over damage taken. Null until the snapshots behind it carry
   * the damage received, which they do from the day that column was added. */
  damageRatio: number | null;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

/** One vehicle's share of a session. */
export type SessionVehicle = SessionStats & {
  tankId: number;
  slug: string | null;
  name: string;
  shortName: string | null;
  tier: number | null;
  nation: string | null;
  type: string | null;
  isPremium: boolean;
  isReward: boolean;
};

/** One bucket of play: what the account did over that day, week or month. */
export type PlayerSession = SessionStats & {
  /** ISO date of the bucket's first day. */
  period: string;
  /** Distinct vehicles taken into battle. */
  tanks: number;
  avgTier: number | null;
  /** Every vehicle played, heaviest first, for the row's breakdown. */
  vehicles: SessionVehicle[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC day a timestamp belongs to. */
function startOfDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/**
 * The bucket a timestamp belongs to, as the ISO date of its first day.
 *
 * Weeks start on Monday (the Unix epoch was a Thursday, hence the shift), and
 * months are calendar months rather than 30 days, because both are read as
 * "last week" and "in July" rather than as rolling windows.
 */
export function sessionPeriod(ms: number, g: SessionGranularity): string {
  const day = startOfDay(ms);
  if (g === SessionGranularity.Weekly) {
    const dow = (Math.floor(day / DAY_MS) + 3) % 7;
    return toISODate(day - dow * DAY_MS);
  }
  if (g === SessionGranularity.Monthly) {
    const d = new Date(day);
    return toISODate(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  return toISODate(day);
}

function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The running totals a set of deltas adds up to, before they become averages. */
type Totals = {
  battles: number;
  wins: number;
  damageDealt: number;
  damageReceived: number;
  /** Battles whose snapshots carried the damage received, so a session that
   * straddles the day that column landed reports the ratio on the part it can
   * account for rather than on a total missing its denominator. */
  damageReceivedBattles: number;
  spotted: number;
  frags: number;
  droppedCapturePoints: number;
  survived: number;
  survivedBattles: number;
  xp: number;
  xpBattles: number;
  assist: number;
};

function emptyTotals(): Totals {
  return {
    battles: 0,
    wins: 0,
    damageDealt: 0,
    damageReceived: 0,
    damageReceivedBattles: 0,
    spotted: 0,
    frags: 0,
    droppedCapturePoints: 0,
    survived: 0,
    survivedBattles: 0,
    xp: 0,
    xpBattles: 0,
    assist: 0,
  };
}

function addDelta(t: Totals, d: SessionDelta): void {
  t.battles += d.battles;
  t.wins += d.wins;
  t.damageDealt += d.damageDealt;
  t.spotted += d.spotted;
  t.frags += d.frags;
  t.droppedCapturePoints += d.droppedCapturePoints;
  t.assist += d.radioAssistedDamage + d.trackAssistedDamage;
  if (d.damageReceived !== null) {
    t.damageReceived += d.damageReceived;
    t.damageReceivedBattles += d.battles;
  }
  if (d.survivedBattles !== null) {
    t.survived += d.survivedBattles;
    t.survivedBattles += d.battles;
  }
  if (d.xp !== null) {
    t.xp += d.xp;
    t.xpBattles += d.battles;
  }
}

function toTankStats(tankId: number, t: Totals): TankStats {
  return {
    tank_id: tankId,
    mark_of_mastery: null,
    all: {
      battles: t.battles,
      wins: t.wins,
      damage_dealt: t.damageDealt,
      spotted: t.spotted,
      frags: t.frags,
      dropped_capture_points: t.droppedCapturePoints,
      radio_assisted_damage: t.assist,
      track_assisted_damage: 0,
      xp: t.xp,
      survived_battles: t.survivedBattles > 0 ? t.survived : undefined,
      damage_received:
        t.damageReceivedBattles > 0 ? t.damageReceived : undefined,
    },
  };
}

/** Averages and ratios from one set of totals, plus the three ratings. */
function toStats(t: Totals, ratings: Ratings): SessionStats {
  const deaths = t.survivedBattles - t.survived;
  return {
    battles: t.battles,
    winrate: t.battles > 0 ? t.wins / t.battles : 0,
    avgDamage: t.battles > 0 ? t.damageDealt / t.battles : 0,
    avgFrags: t.battles > 0 ? t.frags / t.battles : 0,
    avgSpotted: t.battles > 0 ? t.spotted / t.battles : 0,
    avgDefense: t.battles > 0 ? t.droppedCapturePoints / t.battles : 0,
    avgAssist: t.battles > 0 ? t.assist / t.battles : 0,
    avgXp: t.xpBattles > 0 ? t.xp / t.xpBattles : null,
    survivalRate: t.survivedBattles > 0 ? t.survived / t.survivedBattles : null,
    kd: deaths > 0 ? t.frags / deaths : null,
    damageRatio:
      t.damageReceivedBattles > 0 && t.damageReceived > 0
        ? t.damageDealt / t.damageReceived
        : null,
    ...ratings,
  };
}

type Ratings = { wn7: number | null; wn8: number | null; wnx: number | null };

/**
 * One player's sessions: what they played, bucketed, newest first.
 *
 * Ratings are recomputed from each bucket's own totals rather than averaged out
 * of the days inside it, which is the whole reason a week is not the mean of
 * its days: WN8 is a ratio of aggregates, so a 4-battle Tuesday must not weigh
 * as much as a 60-battle Saturday.
 */
export function buildPlayerSessions(
  deltas: SessionDelta[],
  granularity: SessionGranularity,
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): PlayerSession[] {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const { idToSlug } = buildTankSlugIndex(encyclopedia);

  // period → tank → totals. Two levels, because a session is both one number
  // per row and one row per vehicle behind it.
  const byPeriod = new Map<string, Map<number, Totals>>();
  for (const d of deltas) {
    if (d.battles <= 0) continue;
    const period = sessionPeriod(d.takenAtMs, granularity);
    let tanks = byPeriod.get(period);
    if (!tanks) byPeriod.set(period, (tanks = new Map()));
    let totals = tanks.get(d.tankId);
    if (!totals) tanks.set(d.tankId, (totals = emptyTotals()));
    addDelta(totals, d);
  }

  const ratings = (tanks: TankStats[]): Ratings => ({
    wn7: computeSessionWN7(tanks, encyclopedia),
    wn8:
      tanks.length > 0
        ? computeWN8(tanks, wn8Expected, encyclopedia, wn8Fallback)
        : null,
    wnx: tanks.length > 0 ? computeWNX(tanks, wnxExpected) : null,
  });

  const sessions: PlayerSession[] = [];
  for (const [period, tanks] of byPeriod) {
    const stats: TankStats[] = [];
    const total = emptyTotals();
    const rows: SessionVehicle[] = [];

    for (const [tankId, t] of tanks) {
      const ts = toTankStats(tankId, t);
      stats.push(ts);
      addTotals(total, t);

      const meta = encyclopedia[String(tankId)] ?? null;
      rows.push({
        tankId,
        slug: idToSlug.get(tankId) ?? null,
        name: meta?.name ?? "",
        shortName: meta?.shortName ?? null,
        tier: meta?.tier ?? null,
        nation: meta?.nation ?? null,
        type: meta?.type ?? null,
        isPremium: meta?.isPremium ?? false,
        isReward: meta?.isReward ?? false,
        ...toStats(t, ratings([ts])),
      });
    }

    rows.sort((a, b) => b.battles - a.battles || b.avgDamage - a.avgDamage);
    sessions.push({
      period,
      tanks: rows.length,
      avgTier: stats.length > 0 ? computeAvgTier(stats, encyclopedia) : null,
      vehicles: rows,
      ...toStats(total, ratings(stats)),
    });
  }

  return sessions.sort((a, b) => b.period.localeCompare(a.period));
}

/** WN7 wants the account's aggregate and its average tier, unlike the other
 * two which are summed per vehicle. */
function computeSessionWN7(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
): number | null {
  if (tanks.length === 0) return null;
  const agg = tanks.reduce(
    (acc, t) => ({
      battles: acc.battles + t.all.battles,
      wins: acc.wins + t.all.wins,
      frags: acc.frags + t.all.frags,
      damageDealt: acc.damageDealt + t.all.damage_dealt,
      spotted: acc.spotted + t.all.spotted,
      droppedCapturePoints:
        acc.droppedCapturePoints + t.all.dropped_capture_points,
    }),
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
  return computeWN7(agg, computeAvgTier(tanks, encyclopedia));
}

function addTotals(into: Totals, from: Totals): void {
  into.battles += from.battles;
  into.wins += from.wins;
  into.damageDealt += from.damageDealt;
  into.damageReceived += from.damageReceived;
  into.damageReceivedBattles += from.damageReceivedBattles;
  into.spotted += from.spotted;
  into.frags += from.frags;
  into.droppedCapturePoints += from.droppedCapturePoints;
  into.survived += from.survived;
  into.survivedBattles += from.survivedBattles;
  into.xp += from.xp;
  into.xpBattles += from.xpBattles;
  into.assist += from.assist;
}
