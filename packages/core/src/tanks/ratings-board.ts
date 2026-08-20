import { desc, eq, sql } from "drizzle-orm";
import {
  TankRatingAxis,
  tankRatingAggregates,
  tankRatings,
  TankReviewStatus,
} from "@unicum.gg/shared";
import { and } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";

/**
 * The reads that cross tanks: the catalogue board, and one reader's own list.
 *
 * Kept apart from the per-tank summary next door because they answer opposite
 * questions. That one is one vehicle in depth, live, every time. These are
 * every vehicle at once and every vote one person cast, and both are served
 * from the rollup or from a single indexed scan.
 */

/** One account's own verdict on one tank, for the form that edits it. Includes
 * the pending and rejected text, which nobody else may see: the author is
 * exactly who needs to know their review has not gone up yet. */
export type OwnTankRating = {
  overall: number;
  fun: number;
  detail: Partial<Record<TankRatingAxis, number>>;
  review: string | null;
  reviewStatus: TankReviewStatus;
  battles: number;
  gameVersion: string | null;
  updatedAt: Date;
};

export async function getOwnTankRating(
  tankId: number,
  userId: string,
): Promise<OwnTankRating | null> {
  const [row] = await db
    .select()
    .from(tankRatings)
    .where(and(eq(tankRatings.tankId, tankId), eq(tankRatings.userId, userId)))
    .limit(1);
  if (!row) return null;

  const detail: Partial<Record<TankRatingAxis, number>> = {};
  const put = (axis: TankRatingAxis, value: number | null) => {
    if (value != null) detail[axis] = value;
  };
  put(TankRatingAxis.Firepower, row.firepower);
  put(TankRatingAxis.Armour, row.armour);
  put(TankRatingAxis.Mobility, row.mobility);
  put(TankRatingAxis.GunHandling, row.gunHandling);
  put(TankRatingAxis.Concealment, row.concealment);
  put(TankRatingAxis.BeginnerFriendliness, row.beginnerFriendliness);
  put(TankRatingAxis.Versatility, row.versatility);

  return {
    overall: row.overall,
    fun: row.fun,
    detail,
    review: row.review,
    reviewStatus: row.reviewStatus as TankReviewStatus,
    battles: row.battles,
    gameVersion: row.gameVersion,
    updatedAt: row.updatedAt,
  };
}
/** One row of the community board: a vehicle's rollup, before the catalogue
 * puts a name and a nation on it. */
export type TankRatingBoardRow = {
  tankId: number;
  votes: number;
  reviews: number;
  overall: number | null;
  fun: number | null;
  overallBayes: number | null;
  funBayes: number | null;
  overallStddev: number | null;
  hype: number | null;
  perceivedPercentile: number | null;
  measuredPercentile: number | null;
};

/** The board, with the two facts about the board itself that its header
 * states: how much has been said in total, and how stale the shrunk means and
 * the hype column are. */
export type TankRatingBoard = {
  rows: TankRatingBoardRow[];
  totalVotes: number;
  /** Null before the rollup cron has ever run, which is also when every
   * `overallBayes` is null: the two go together and the header says so. */
  computedAt: Date | null;
};

/**
 * Every rated vehicle's rollup, for the community board and the catalogue
 * column.
 *
 * Uncapped and unfiltered on purpose: the table it feeds sorts and filters in
 * the browser like every other table on the site, and there are about eleven
 * hundred vehicles, of which only the rated ones have a row here. Vehicles with
 * no votes are simply absent, which is what lets the caller tell "nobody has
 * rated it" from "rated badly".
 */
export async function listTankRatingBoard(): Promise<TankRatingBoard> {
  const rows = await db
    .select()
    .from(tankRatingAggregates)
    .where(sql`${tankRatingAggregates.votes} > 0`);

  return {
    rows: rows.map((r) => ({
      tankId: r.tankId,
      votes: r.votes,
      reviews: r.reviews,
      overall: r.overallAvg,
      fun: r.funAvg,
      overallBayes: r.overallBayes,
      funBayes: r.funBayes,
      overallStddev: r.overallStddev,
      hype: r.hype,
      perceivedPercentile: r.perceivedPercentile,
      measuredPercentile: r.measuredPercentile,
    })),
    totalVotes: rows.reduce((sum, r) => sum + r.votes, 0),
    // The newest stamp rather than the oldest: every row is written in the same
    // statement, so they agree, and a row inserted by a later run is the one
    // that says when that run happened.
    computedAt: rows.reduce<Date | null>(
      (newest, r) =>
        newest == null || r.computedAt > newest ? r.computedAt : newest,
      null,
    ),
  };
}

/** Every tank one account has rated, for their own page and for the garage
 * prompts that ask them about the rest. */
export async function listOwnRatings(userId: string): Promise<
  {
    tankId: number;
    overall: number;
    fun: number;
    battles: number;
    reviewStatus: TankReviewStatus;
    updatedAt: Date;
  }[]
> {
  const rows = await db
    .select({
      tankId: tankRatings.tankId,
      overall: tankRatings.overall,
      fun: tankRatings.fun,
      battles: tankRatings.battles,
      reviewStatus: tankRatings.reviewStatus,
      updatedAt: tankRatings.updatedAt,
    })
    .from(tankRatings)
    .where(eq(tankRatings.userId, userId))
    .orderBy(desc(tankRatings.updatedAt));

  return rows.map((r) => ({
    ...r,
    reviewStatus: r.reviewStatus as TankReviewStatus,
  }));
}
