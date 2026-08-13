import { asc, eq, sql } from "drizzle-orm";
import {
  buildPlayerSessions,
  playerSnapshotsByRegion,
  playersByRegion,
  SessionGranularity,
  tankSnapshotsByRegion,
  type PlayerSession,
  type SessionDelta,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";

/**
 * How many buckets each granularity serves.
 *
 * Enough to cover the same ground in every mode (a quarter, a year, two years)
 * without letting the monthly view drag a decade of a veteran's history into
 * one payload.
 */
const BUCKET_LIMIT: Record<SessionGranularity, number> = {
  [SessionGranularity.Daily]: 90,
  [SessionGranularity.Weekly]: 52,
  [SessionGranularity.Monthly]: 24,
};

/**
 * What a player did, session by session.
 *
 * The game keeps no session log and Wargaming exposes none, so a session is
 * reconstructed from what we sampled: the difference between two consecutive
 * snapshots of the same vehicle is a set of battles, and those get bucketed by
 * when we saw them. The snapshot cadence adapts to how much someone plays, so
 * an active account is sampled several times a day and a day's row is a day's
 * play.
 *
 * Reads every snapshot the player has, like the rating history beside it: the
 * table's primary key is `(player_id, tank_id, taken_at)`, so the scan is one
 * index range per player, and the alternative (a window filter) would need a
 * baseline row from before the window anyway.
 */
export async function getPlayerSessions(
  region: Region,
  playerId: number,
  granularity: SessionGranularity,
): Promise<PlayerSession[]> {
  const snapshots = tankSnapshotsByRegion[region];
  const rows = await db
    .select({
      tankId: snapshots.tankId,
      takenAt: snapshots.takenAt,
      battles: snapshots.battles,
      wins: snapshots.wins,
      damageDealt: snapshots.damageDealt,
      damageReceived: snapshots.damageReceived,
      spotted: snapshots.spotted,
      frags: snapshots.frags,
      droppedCapturePoints: snapshots.droppedCapturePoints,
      survivedBattles: snapshots.survivedBattles,
      xp: snapshots.xp,
      radioAssistedDamage: snapshots.radioAssistedDamage,
      trackAssistedDamage: snapshots.trackAssistedDamage,
    })
    .from(snapshots)
    .where(eq(snapshots.playerId, playerId))
    // Per vehicle, in the order it happened. `battles` breaks a tie on
    // `taken_at`, since a chunk written under one `now()` is still a sequence.
    .orderBy(asc(snapshots.tankId), asc(snapshots.takenAt), asc(snapshots.battles));

  if (rows.length === 0) return [];

  const [playedUpTo, encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    readLastBattleTimes(region, playerId),
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
  ]);

  return buildPlayerSessions(
    toDeltas(rows, playedUpTo),
    granularity,
    encyclopedia,
    wn8Expected,
    wnxExpected,
  ).slice(0, BUCKET_LIMIT[granularity]);
}

type Row = {
  tankId: number;
  takenAt: Date;
  battles: number;
  wins: number;
  damageDealt: number;
  damageReceived: number | null;
  spotted: number;
  frags: number;
  droppedCapturePoints: number;
  survivedBattles: number | null;
  xp: number | null;
  radioAssistedDamage: number;
  trackAssistedDamage: number;
};

/**
 * Consecutive snapshots of a vehicle into the battles between them.
 *
 * The first snapshot of a vehicle is never a session of its own. It reads as
 * one (its counters are what was played) but there is no baseline to subtract,
 * so a player whose history starts mid-career would open with a single day
 * holding their entire time on that tank. The cost of leaving it out is one
 * missing session at the very edge of what we ever sampled; the cost of keeping
 * it is a fabricated 5,000-battle Tuesday.
 *
 * A negative difference is dropped rather than clamped: Wargaming occasionally
 * answers with stale counters, and a rollback is not a session.
 */
function toDeltas(rows: Row[], playedUpTo: PlayedUpTo): SessionDelta[] {
  const deltas: SessionDelta[] = [];
  let prev: Row | null = null;

  for (const row of rows) {
    if (prev && prev.tankId === row.tankId) {
      const battles = row.battles - prev.battles;
      if (battles > 0) {
        deltas.push({
          tankId: row.tankId,
          takenAtMs: playedUpTo.at(row.takenAt.getTime()),
          battles,
          // Clamped: the battle count moved forward, so a counter that did not
          // is Wargaming answering with a stale value, and a negative would
          // read as a win rate below zero rather than as the blip it is.
          wins: rise(row.wins, prev.wins),
          damageDealt: rise(row.damageDealt, prev.damageDealt),
          // Both ends must carry the counter for the difference to mean
          // anything: subtracting from a null baseline would report a career
          // total as one session's damage taken.
          damageReceived: diffOrNull(row.damageReceived, prev.damageReceived),
          spotted: rise(row.spotted, prev.spotted),
          frags: rise(row.frags, prev.frags),
          droppedCapturePoints: rise(
            row.droppedCapturePoints,
            prev.droppedCapturePoints,
          ),
          survivedBattles: diffOrNull(
            row.survivedBattles,
            prev.survivedBattles,
          ),
          xp: diffOrNull(row.xp, prev.xp),
          radioAssistedDamage: rise(
            row.radioAssistedDamage,
            prev.radioAssistedDamage,
          ),
          trackAssistedDamage: rise(
            row.trackAssistedDamage,
            prev.trackAssistedDamage,
          ),
        });
      }
    }
    prev = row;
  }

  return deltas;
}

/** How much a counter rose, never how much it fell. */
function rise(now: number, before: number): number {
  return Math.max(0, now - before);
}

function diffOrNull(now: number | null, before: number | null): number | null {
  if (now === null || before === null) return null;
  const d = now - before;
  return d >= 0 ? d : null;
}

/** When the battles a snapshot observed were actually fought. */
type PlayedUpTo = { at(takenAtMs: number): number };

// A tank snapshot and the account snapshot of the same pass are written under
// two separate `now()` calls, so they are the same moment without being the
// same timestamp. Anything closer than this is one pass.
const SAME_PASS_MS = 5 * 60 * 1000;

/**
 * The account's last battle at each sample, for dating a stretch of play.
 *
 * A delta is a set of battles that ended when the player last fought, not when
 * the pipeline got round to looking: an evening session sampled after midnight
 * belongs to the evening. The two timestamps agree for an account sampled while
 * it plays and diverge for one sampled the morning after, which is exactly the
 * case a session list has to get right.
 *
 * Falls back to the observation time, both for snapshots older than the column
 * and for a tank snapshot with no account snapshot of the same pass.
 */
async function readLastBattleTimes(
  region: Region,
  playerId: number,
): Promise<PlayedUpTo> {
  const snapshots = playerSnapshotsByRegion[region];
  const rows = await db
    .select({
      takenAt: snapshots.takenAt,
      lastBattleAt: snapshots.lastBattleAt,
    })
    .from(snapshots)
    .where(eq(snapshots.playerId, playerId))
    .orderBy(asc(snapshots.takenAt));

  const samples = rows
    .filter((r) => r.lastBattleAt !== null)
    .map((r) => ({
      takenAtMs: r.takenAt.getTime(),
      lastBattleMs: r.lastBattleAt!.getTime(),
    }));

  return {
    at(takenAtMs: number): number {
      const i = lastIndexAtOrBefore(samples, takenAtMs + SAME_PASS_MS);
      const s = i >= 0 ? samples[i] : null;
      if (!s || takenAtMs - s.takenAtMs > SAME_PASS_MS) return takenAtMs;
      // Never ahead of the sample: a last battle after we looked would be from
      // a pass we have not read yet.
      return Math.min(s.lastBattleMs, takenAtMs);
    },
  };
}

/** Index of the newest sample at or before `ms`, or -1. Binary search: the
 * caller runs it once per delta, and a busy account has thousands of both. */
function lastIndexAtOrBefore(
  samples: { takenAtMs: number }[],
  ms: number,
): number {
  let lo = 0;
  let hi = samples.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].takenAtMs <= ms) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/**
 * The same, by nickname: what the endpoint and the page ask for.
 *
 * Null when we do not track the player, which the caller answers as a 404. A
 * player we do track but have never sampled twice simply has no session yet,
 * which is an empty list rather than a missing page.
 */
export async function loadPlayerSessions(
  region: Region,
  nickname: string,
  granularity: SessionGranularity,
): Promise<PlayerSession[] | null> {
  const players = playersByRegion[region];
  const [row] = await db
    .select({ id: players.id })
    .from(players)
    // Case-insensitive, like the player detail and the vehicle record: a
    // nickname is one account whatever case it is typed in, and the functional
    // index on `lower(nickname)` makes it the same lookup.
    .where(sql`LOWER(${players.nickname}) = LOWER(${nickname})`)
    .limit(1);
  if (!row) return null;
  return getPlayerSessions(region, row.id, granularity);
}
