import { and, asc, desc, eq, lt, notInArray, or, sql } from "drizzle-orm";
import {
  TIER_FLOORS,
  TOP_PLAYERS_MIN_BATTLES,
  type TierFloor,
  type VehicleMeta,
  type WN8Expected,
  type WNXExpected,
  computeAvgTier,
  computeWN7,
  computeWN8,
  computeWNX,
  playerTierWindowRatingsByRegion,
  tankSnapshotsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import { TopPlayersPeriod } from "@unicum.gg/core/wargaming/wot/players/top/period";
import type { Region } from "@unicum.gg/wargaming";
import { diffTanks } from "./tanks";

/** What a rating over a set of battles needs besides the battles. */
export type RatingContext = {
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
  wn8Fallback: Map<string, WN8Expected>;
};

export type WindowRating = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  battles: number | null;
  wins: number | null;
};

export type RecentWindow = Exclude<TopPlayersPeriod, TopPlayersPeriod.Overall>;

/** One window's ratings: over every battle, and over the battles at or above
 * each tier floor the recent boards rank by. */
export type WindowRatings = {
  all: WindowRating;
  byFloor: Record<TierFloor, WindowRating>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const WINDOW_MS: Record<RecentWindow, number> = {
  [TopPlayersPeriod.Day]: DAY_MS,
  [TopPlayersPeriod.Week]: 7 * DAY_MS,
  [TopPlayersPeriod.Month]: 30 * DAY_MS,
};

const RECENT_WINDOWS = Object.keys(WINDOW_MS) as RecentWindow[];

const EMPTY: WindowRating = { wn7: null, wn8: null, wnx: null, battles: null, wins: null };

/**
 * Rate a set of per-vehicle battle counts (a window's diff).
 */
export function rateTanks(recent: TankStats[], ctx: RatingContext): WindowRating {
  if (recent.length === 0) return EMPTY;
  const wnx = computeWNX(recent, ctx.wnxExpected);
  const wn8 = computeWN8(recent, ctx.wn8Expected, ctx.encyclopedia, ctx.wn8Fallback);
  // WN7 needs aggregate stats and the average tier over the same battles.
  const agg = recent.reduce(
    (acc, t) => {
      acc.battles += t.all.battles;
      acc.wins += t.all.wins;
      acc.frags += t.all.frags;
      acc.damageDealt += t.all.damage_dealt;
      acc.spotted += t.all.spotted;
      acc.droppedCapturePoints += t.all.dropped_capture_points;
      return acc;
    },
    { battles: 0, wins: 0, frags: 0, damageDealt: 0, spotted: 0, droppedCapturePoints: 0 },
  );
  const wn7 =
    agg.battles > 0 ? computeWN7(agg, computeAvgTier(recent, ctx.encyclopedia)) : null;
  // The wins are kept beside the battles they were counted with, rather than
  // consumed by WN7 and dropped: a window's win rate is `wins / battles` over
  // the SAME diff, and recovering it later means either a second pass over the
  // snapshots or a different window, which is how a recent win rate ends up
  // disagreeing with the recent rating printed beside it.
  return { wn7, wn8, wnx, battles: agg.battles, wins: agg.wins };
}

/**
 * What a player fought in each vehicle over the last `windowMs`.
 *
 * Per tank we take the newest snapshot older than the cutoff, or (for players
 * tracked less than the window) the oldest snapshot other than the current
 * one, so a short history still reflects the games played instead of coming
 * back empty. Mirrors the player-page period baseline in initial-data.ts.
 */
async function windowDiff(
  region: Region,
  playerId: number,
  tanks: TankStats[],
  windowMs: number,
): Promise<TankStats[]> {
  const tankSnapshots = tankSnapshotsByRegion[region];
  const cutoff = new Date(Date.now() - windowMs);
  const cutoffTs = sql`${cutoff.toISOString()}::timestamptz`;
  const rows = await db
    .selectDistinctOn([tankSnapshots.tankId], {
      tankId: tankSnapshots.tankId,
      battles: tankSnapshots.battles,
      wins: tankSnapshots.wins,
      damageDealt: tankSnapshots.damageDealt,
      spotted: tankSnapshots.spotted,
      frags: tankSnapshots.frags,
      droppedCapturePoints: tankSnapshots.droppedCapturePoints,
      radioAssistedDamage: tankSnapshots.radioAssistedDamage,
      trackAssistedDamage: tankSnapshots.trackAssistedDamage,
      xp: tankSnapshots.xp,
      markOfMastery: tankSnapshots.markOfMastery,
      takenAt: tankSnapshots.takenAt,
    })
    .from(tankSnapshots)
    .where(
      and(
        eq(tankSnapshots.playerId, playerId),
        or(
          lt(tankSnapshots.takenAt, cutoff),
          sql`${tankSnapshots.takenAt} < (SELECT MAX(ts2.taken_at) FROM ${tankSnapshots} ts2 WHERE ts2.player_id = ${playerId} AND ts2.tank_id = ${tankSnapshots.tankId})`,
        ),
      ),
    )
    .orderBy(
      tankSnapshots.tankId,
      sql`(${tankSnapshots.takenAt} < ${cutoffTs}) DESC`,
      sql`CASE WHEN ${tankSnapshots.takenAt} < ${cutoffTs} THEN ${tankSnapshots.takenAt} END DESC`,
      asc(tankSnapshots.takenAt),
      // Same-`taken_at` tie-break: battles is monotonic per tank (see
      // carryForwardMarks).
      desc(tankSnapshots.battles),
    );
  if (rows.length === 0) return [];
  const baseline = new Map(
    rows.map((r) => [
      r.tankId,
      {
        id: 0,
        playerId,
        tankId: r.tankId,
        takenAt: r.takenAt,
        battles: r.battles,
        wins: r.wins,
        damageDealt: r.damageDealt,
        spotted: r.spotted,
        frags: r.frags,
        droppedCapturePoints: r.droppedCapturePoints,
        radioAssistedDamage: r.radioAssistedDamage,
        trackAssistedDamage: r.trackAssistedDamage,
        xp: r.xp,
        markOfMastery: r.markOfMastery,
        // Not needed for the rating diff.
        marksOnGun: null,
        markPercent: null,
        survivedBattles: null,
        hits: null,
        shots: null,
        piercings: null,
        damageBlocked: null,
        damageReceived: null,
        capturePoints: null,
        stunNumber: null,
        stunAssistedDamage: null,
        tankingFactor: null,
        maxXp: null,
        maxFrags: null,
      },
    ]),
  );
  return diffTanks(tanks, baseline);
}

/**
 * A player's ratings over each recent window (24h, 7d, 30d), over every battle
 * and over each tier floor's share of them, from one diff per window.
 *
 * The floors are a filter on the same diff rather than a query of their own, so
 * they cost nothing beyond the arithmetic. The cheap per-player DISTINCT-ON
 * queries run in parallel; keeping these in lockstep with every snapshot is what
 * lets the leaderboards rank by stored values instead of scanning the
 * 300M-row tank_snapshots table every hour.
 */
export async function computeWindowRatings(
  region: Region,
  playerId: number,
  tanks: TankStats[],
  ctx: RatingContext,
): Promise<Record<RecentWindow, WindowRatings>> {
  const diffs = await Promise.all(
    RECENT_WINDOWS.map((w) => windowDiff(region, playerId, tanks, WINDOW_MS[w])),
  );
  const out = {} as Record<RecentWindow, WindowRatings>;
  RECENT_WINDOWS.forEach((window, i) => {
    const recent = diffs[i];
    const byFloor = {} as Record<TierFloor, WindowRating>;
    for (const floor of TIER_FLOORS) {
      byFloor[floor] = rateTanks(
        recent.filter((t) => (ctx.encyclopedia[String(t.tank_id)]?.tier ?? 0) >= floor),
        ctx,
      );
    }
    out[window] = { all: rateTanks(recent, ctx), byFloor };
  });
  return out;
}

/**
 * Store the per-floor window ratings the recent boards rank by.
 *
 * Only what clears the window's battle floor is kept, since nothing else reads
 * this table, and what no longer clears it is removed in the same pass, so the
 * table holds exactly the rankable rows as of the account's last snapshot.
 */
export async function writeTierWindowRatings(
  region: Region,
  accountId: number,
  windows: Record<RecentWindow, WindowRatings>,
): Promise<void> {
  const table = playerTierWindowRatingsByRegion[region];
  const rows = RECENT_WINDOWS.flatMap((period) =>
    TIER_FLOORS.flatMap((minTier) => {
      const r = windows[period].byFloor[minTier];
      if (r.battles == null || r.battles < TOP_PLAYERS_MIN_BATTLES[period]) return [];
      return [
        {
          accountId,
          period,
          minTier,
          battles: r.battles,
          wins: r.wins ?? 0,
          wn7: r.wn7,
          wn8: r.wn8,
          wnx: r.wnx,
          updatedAt: new Date(),
        },
      ];
    }),
  );
  const keys = rows.map((r) => `${r.period}:${r.minTier}`);
  await db
    .delete(table)
    .where(
      and(
        eq(table.accountId, accountId),
        keys.length > 0
          ? notInArray(sql`${table.period} || ':' || ${table.minTier}`, keys)
          : undefined,
      ),
    );
  if (rows.length === 0) return;
  await db
    .insert(table)
    .values(rows)
    .onConflictDoUpdate({
      target: [table.accountId, table.period, table.minTier],
      set: {
        battles: sql`excluded.battles`,
        wins: sql`excluded.wins`,
        wn7: sql`excluded.wn7`,
        wn8: sql`excluded.wn8`,
        wnx: sql`excluded.wnx`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}
