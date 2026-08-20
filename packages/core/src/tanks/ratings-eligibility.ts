import { sql } from "drizzle-orm";
import {
  buildWN8Fallback,
  computeWN8,
  MIN_BATTLES_TO_RATE,
  playersByRegion,
  RatingBlock,
  tankSnapshotsByRegion,
  voterBracket,
  type TankStats,
  type VoterBracket,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { enqueuePlayerRefreshBackground } from "@unicum.gg/core/players/refresh-queue";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getWN8ExpectedValues } from "@unicum.gg/core/wargaming/wot/wn-expected";

/**
 * Casting an opinion on a vehicle, and the one check that makes the resulting
 * average worth more than anyone else's.
 *
 * Every community score in this game is a poll of whoever showed up, which is
 * how a tank that is unpleasant to play against gets rated as though it were
 * unpleasant to play. We can do better, because the voter signs in with their
 * Wargaming account and we hold their record on that exact vehicle: a vote is
 * refused until they have actually taken it out, and the sample it rests on is
 * stored on the row so the page can show what the opinion is worth.
 */

/** What the voter has done on the tank, as of their newest snapshot. Copied
 * onto the vote so the page can show what the opinion rests on, and so a later
 * refresh cannot rewrite the sample an already-cast vote was formed from. */
export type VoterRecord = {
  battles: number;
  winrate: number | null;
  avgDamage: number | null;
  tankWn8: number | null;
  marksOnGun: number | null;
  markOfMastery: number | null;
};

/** The voter themselves, which is what the bracket split is cut on. */
export type VoterProfile = {
  wn8: number | null;
  battles: number | null;
  bracket: VoterBracket;
};

export type RatingEligibility = {
  eligible: boolean;
  block: RatingBlock | null;
  /** Battles on the tank the gate asks for, so the UI can say how far off
   * someone is rather than just refusing them. */
  required: number;
  record: VoterRecord | null;
  player: VoterProfile | null;
};

type EligibilityRow = {
  player_id: number;
  player_wn8: number | null;
  player_battles: number | null;
  battles: number | null;
  wins: number | null;
  damage_dealt: number | null;
  spotted: number | null;
  frags: number | null;
  dropped_capture_points: number | null;
  radio_assisted_damage: number | null;
  track_assisted_damage: number | null;
  marks_on_gun: number | null;
  mark_of_mastery: number | null;
};

/**
 * May this account rate this tank, and on what evidence.
 *
 * One round trip: the player row carries the cached account rating the bracket
 * is cut on, and a lateral join picks their newest snapshot of the vehicle. The
 * `(player_id, tank_id, taken_at)` ordering is the same one the Service Record
 * read uses, so this costs a single index descent rather than a scan.
 *
 * An account we have never seen is not refused outright: a refresh is queued at
 * the same priority a page hit uses, so the answer flips on its own within a
 * tick or two. Anything else would tell a genuine player they do not own a tank
 * they have four thousand battles in.
 */
export async function getRatingEligibility(
  region: Region,
  accountId: number,
  tankId: number,
): Promise<RatingEligibility> {
  const players = playersByRegion[region];
  const snapshots = tankSnapshotsByRegion[region];

  const rows = (await db.execute(sql`
    SELECT
      p.id                       AS player_id,
      p.wn8                      AS player_wn8,
      p.battles                  AS player_battles,
      s.battles,
      s.wins,
      s.damage_dealt,
      s.spotted,
      s.frags,
      s.dropped_capture_points,
      s.radio_assisted_damage,
      s.track_assisted_damage,
      s.marks_on_gun,
      s.mark_of_mastery
    FROM ${players} p
    LEFT JOIN LATERAL (
      SELECT *
      FROM ${snapshots}
      WHERE player_id = p.id AND tank_id = ${tankId}
      ORDER BY taken_at DESC, battles DESC
      LIMIT 1
    ) s ON TRUE
    WHERE p.account_id = ${accountId}
    LIMIT 1
  `)) as unknown as EligibilityRow[];

  const row = rows[0];
  if (!row) {
    // Queued rather than fetched inline: the pipeline already knows how to
    // spend a WG call on one account, and making the caller wait on it would
    // put a live Wargaming round trip in front of a button press.
    enqueuePlayerRefreshBackground(region, [accountId], { priority: 10 });
    return {
      eligible: false,
      block: RatingBlock.NoRecord,
      required: MIN_BATTLES_TO_RATE,
      record: null,
      player: null,
    };
  }

  const player: VoterProfile = {
    wn8: row.player_wn8 == null ? null : Number(row.player_wn8),
    battles: row.player_battles == null ? null : Number(row.player_battles),
    bracket: voterBracket(row.player_wn8 == null ? null : Number(row.player_wn8)),
  };

  if (row.battles == null || Number(row.battles) <= 0) {
    return {
      eligible: false,
      block: RatingBlock.NeverPlayed,
      required: MIN_BATTLES_TO_RATE,
      record: null,
      player,
    };
  }

  const record = await voterRecordFromRow(region, tankId, row);
  return {
    eligible: record.battles >= MIN_BATTLES_TO_RATE,
    block:
      record.battles >= MIN_BATTLES_TO_RATE ? null : RatingBlock.TooFewBattles,
    required: MIN_BATTLES_TO_RATE,
    record,
    player,
  };
}

/**
 * Turn the snapshot row into the sample a vote is signed with.
 *
 * The WN8 is computed here rather than read: it is a per-tank figure and we
 * store counters, not ratings, on `tank_snapshots`. Both inputs it needs (the
 * expected values and the vehicle catalogue) are memoized for the day, so this
 * costs no network call, and a vehicle with no expected values yet answers null
 * rather than a number nobody can reproduce.
 */
async function voterRecordFromRow(
  region: Region,
  tankId: number,
  row: EligibilityRow,
): Promise<VoterRecord> {
  const battles = Number(row.battles);
  const stats: TankStats = {
    tank_id: tankId,
    mark_of_mastery: row.mark_of_mastery ?? null,
    marks_on_gun: row.marks_on_gun ?? null,
    all: {
      battles,
      wins: Number(row.wins ?? 0),
      damage_dealt: Number(row.damage_dealt ?? 0),
      spotted: Number(row.spotted ?? 0),
      frags: Number(row.frags ?? 0),
      dropped_capture_points: Number(row.dropped_capture_points ?? 0),
      radio_assisted_damage: Number(row.radio_assisted_damage ?? 0),
      track_assisted_damage: Number(row.track_assisted_damage ?? 0),
      xp: 0,
    },
  };

  const [encyclopedia, expected] = await Promise.all([
    getVehicleEncyclopedia(region).catch(() => ({})),
    getWN8ExpectedValues().catch(() => new Map()),
  ]);
  const tankWn8 = computeWN8(
    [stats],
    expected,
    encyclopedia,
    buildWN8Fallback(expected, encyclopedia),
  );

  return {
    battles,
    winrate: battles > 0 ? Number(row.wins ?? 0) / battles : null,
    avgDamage: battles > 0 ? Number(row.damage_dealt ?? 0) / battles : null,
    tankWn8,
    marksOnGun: row.marks_on_gun ?? null,
    markOfMastery: row.mark_of_mastery ?? null,
  };
}

