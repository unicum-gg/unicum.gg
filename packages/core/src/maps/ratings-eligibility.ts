import { sql } from "drizzle-orm";
import {
  MAP_MIN_BATTLES_TO_RATE,
  playersByRegion,
  RatingBlock,
  voterBracket,
  type VoterBracket,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { enqueuePlayerRefreshBackground } from "@unicum.gg/core/players/refresh-queue";

/**
 * Who may rate a map, and on what evidence.
 *
 * The vehicle gate next door reads the voter's record on that exact tank, which
 * is what makes its average worth more than a poll of whoever showed up. That
 * reading does not exist for a map and cannot be built: Wargaming publishes no
 * per-arena record for anybody, and nothing we could accumulate would recover
 * one, since a battle result says nothing about where it was fought.
 *
 * What a map has instead is the rotation. Nobody chooses where they are sent,
 * so exposure follows from playing at all rather than from owning anything, and
 * the account's own battle count is the honest proxy. That is a weaker claim
 * than the vehicle gate's and the UI says so rather than implying a check it
 * did not make.
 *
 * `RatingBlock` is reused rather than reinvented, with two of its three values:
 * `NoRecord` (we have never snapshotted this account) and `TooFewBattles`.
 * `NeverPlayed` is deliberately unreachable here, because "has this account
 * played this arena" is exactly the question nothing can answer.
 */

/**
 * The voter, which is the whole of the evidence a map vote is signed with.
 *
 * One type rather than the vehicle side's two (`VoterRecord` about the tank,
 * `VoterProfile` about the player), because here they collapse: there is
 * nothing about the arena to record.
 */
export type MapVoterProfile = {
  wn8: number | null;
  /** Lifetime battles, which is what the gate is decided on. */
  battles: number | null;
  /** Battles in the trailing thirty days: whether this is an opinion about the
   * map as it is now rather than as it was three reworks ago. */
  recentBattles: number | null;
  winrate: number | null;
  bracket: VoterBracket;
};

export type MapRatingEligibility = {
  eligible: boolean;
  block: RatingBlock | null;
  /** Battles the gate asks for, so the UI can say how far off someone is
   * rather than just refusing them. */
  required: number;
  player: MapVoterProfile | null;
};

type EligibilityRow = {
  wn8: number | null;
  battles: number | null;
  battles_30d: number | null;
  winrate: number | null;
};

/**
 * One indexed read of the player row, which already carries every column this
 * needs: the account rating the bracket is cut on, the lifetime battles the
 * gate reads, the trailing thirty days a review is dated by, and the win rate a
 * review is signed with. No snapshot join, because there is no per-arena
 * snapshot to join to.
 *
 * An account we have never seen is not refused outright: a refresh is queued at
 * the same priority a page hit uses, so the answer flips on its own within a
 * tick or two. Anything else would tell a genuine player we have no record of
 * the forty thousand battles they have played.
 */
export async function getMapRatingEligibility(
  region: Region,
  accountId: number,
): Promise<MapRatingEligibility> {
  const players = playersByRegion[region];

  const rows = (await db.execute(sql`
    SELECT wn8, battles, battles_30d, winrate
    FROM ${players}
    WHERE account_id = ${accountId}
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
      required: MAP_MIN_BATTLES_TO_RATE,
      player: null,
    };
  }

  const wn8 = row.wn8 == null ? null : Number(row.wn8);
  const battles = row.battles == null ? null : Number(row.battles);
  const player: MapVoterProfile = {
    wn8,
    battles,
    recentBattles: row.battles_30d == null ? null : Number(row.battles_30d),
    winrate: row.winrate == null ? null : Number(row.winrate),
    bracket: voterBracket(wn8),
  };

  // A known account with no battle count is a row we have resolved but never
  // filled in, which reads as "not enough" rather than as a refusal to count:
  // the gate is a floor, and an unknown figure is below every floor.
  const eligible = (battles ?? 0) >= MAP_MIN_BATTLES_TO_RATE;
  return {
    eligible,
    block: eligible ? null : RatingBlock.TooFewBattles,
    required: MAP_MIN_BATTLES_TO_RATE,
    player,
  };
}
