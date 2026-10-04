import { and, desc, eq, sql } from "drizzle-orm";
import {
  MapRatingAxis,
  mapRatingAggregates,
  mapRatings,
  TankReviewStatus,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * The reads that cross maps: the board, and one reader's own list.
 *
 * Kept apart from the per-map summary next door because they answer opposite
 * questions. That one is one arena in depth, live, every time. These are every
 * arena at once and every vote one person cast, and both are served from the
 * rollup or from a single indexed scan.
 */

/** One account's own verdict on one map, for the form that edits it. Includes
 * the pending and rejected text, which nobody else may see: the author is
 * exactly who needs to know their review has not gone up yet. */
export type OwnMapRating = {
  overall: number;
  fun: number;
  detail: Partial<Record<MapRatingAxis, number>>;
  review: string | null;
  reviewStatus: TankReviewStatus;
  gameVersion: string | null;
  updatedAt: Date;
};

export async function getOwnMapRating(
  arenaId: string,
  userId: string,
): Promise<OwnMapRating | null> {
  const [row] = await db
    .select()
    .from(mapRatings)
    .where(and(eq(mapRatings.arenaId, arenaId), eq(mapRatings.userId, userId)))
    .limit(1);
  if (!row) return null;

  const detail: Partial<Record<MapRatingAxis, number>> = {};
  const put = (axis: MapRatingAxis, value: number | null) => {
    if (value != null) detail[axis] = value;
  };
  put(MapRatingAxis.Balance, row.balance);
  put(MapRatingAxis.Variety, row.variety);
  put(MapRatingAxis.Flow, row.flow);
  put(MapRatingAxis.ClassFairness, row.classFairness);
  put(MapRatingAxis.BeginnerFriendliness, row.beginnerFriendliness);

  return {
    overall: row.overall,
    fun: row.fun,
    detail,
    review: row.review,
    reviewStatus: row.reviewStatus as TankReviewStatus,
    gameVersion: row.gameVersion,
    updatedAt: row.updatedAt,
  };
}

/** One row of the community board: an arena's rollup, before the catalogue puts
 * a name and a minimap on it. */
export type MapRatingBoardRow = {
  arenaId: string;
  votes: number;
  reviews: number;
  overall: number | null;
  fun: number | null;
  overallBayes: number | null;
  funBayes: number | null;
  overallStddev: number | null;
};

/** The board, with the two facts about the board itself that its header
 * states: how much has been said in total, and how stale the shrunk means
 * are. */
export type MapRatingBoard = {
  rows: MapRatingBoardRow[];
  totalVotes: number;
  /** Null before the rollup cron has ever run, which is also when every
   * `overallBayes` is null: the two go together and the header says so. */
  computedAt: Date | null;
};

/**
 * Every rated arena's rollup, for the community board and the gallery's score.
 *
 * Uncapped and unfiltered on purpose: the catalogue is around fifty arenas, the
 * table it feeds sorts in the browser like every other table on the site, and
 * only the rated ones have a row here. Arenas with no votes are simply absent,
 * which is what lets the caller tell "nobody has rated it" from "rated badly".
 */
export async function listMapRatingBoard(): Promise<MapRatingBoard> {
  const rows = await db
    .select()
    .from(mapRatingAggregates)
    .where(sql`${mapRatingAggregates.votes} > 0`);

  return {
    rows: rows.map((r) => ({
      arenaId: r.arenaId,
      votes: r.votes,
      reviews: r.reviews,
      overall: r.overallAvg,
      fun: r.funAvg,
      overallBayes: r.overallBayes,
      funBayes: r.funBayes,
      overallStddev: r.overallStddev,
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

/** Every map one account has rated, for their own page and for the prompts that
 * ask them about the rest. */
export async function listOwnMapRatings(userId: string): Promise<
  {
    arenaId: string;
    overall: number;
    fun: number;
    reviewStatus: TankReviewStatus;
    updatedAt: Date;
  }[]
> {
  const rows = await db
    .select({
      arenaId: mapRatings.arenaId,
      overall: mapRatings.overall,
      fun: mapRatings.fun,
      reviewStatus: mapRatings.reviewStatus,
      updatedAt: mapRatings.updatedAt,
    })
    .from(mapRatings)
    .where(eq(mapRatings.userId, userId))
    .orderBy(desc(mapRatings.updatedAt));

  return rows.map((r) => ({
    ...r,
    reviewStatus: r.reviewStatus as TankReviewStatus,
  }));
}
