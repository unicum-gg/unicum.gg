import { and, desc, eq, sql } from "drizzle-orm";
import {
  MAP_DETAIL_AXES,
  MapRatingAxis,
  mapRatingAggregates,
  mapRatings,
  MAX_STARS,
  MIN_STARS,
  ratingConsensus,
  starDistribution,
  TankReviewStatus,
  VOTER_BRACKETS,
  VoterBracket,
  type BracketVerdict,
  type MapAxisVerdict,
  type MapRatingSummary,
  type MapReview,
  type RegionVerdict,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/**
 * Reading the community's verdict on a map back.
 *
 * Two shapes, which is why they are two functions, and the same split the
 * vehicle reads landed on. One arena is an indexed group-by that has to produce
 * two histograms, a split by how well the voters play, a split by server and
 * five axis means, all live, so the page never contradicts a vote cast a second
 * ago. The lists are the opposite problem, the whole catalogue at once behind a
 * cached render, which is what the rollup table is for.
 *
 * The shared readings (`ratingConsensus`, `starDistribution`) come from the
 * vehicle module rather than being restated: a spread is a spread, and two
 * copies of the thresholds would eventually call the same distribution
 * "divisive" on one page and "mixed" on the other.
 */

/** How many published opinions a map panel carries. Capped rather than
 * paginated: this is a panel of verdicts, not a forum, and the ones that do not
 * fit are the ones a reader was never going to reach. */
const REVIEW_LIMIT = 30;

/** The database column each optional axis lives in, so the aggregate query can
 * be written once over the list instead of five times by hand. */
const AXIS_COLUMN: Record<string, string> = {
  [MapRatingAxis.Balance]: "balance",
  [MapRatingAxis.Variety]: "variety",
  [MapRatingAxis.Flow]: "flow",
  [MapRatingAxis.ClassFairness]: "class_fairness",
  [MapRatingAxis.BeginnerFriendliness]: "beginner_friendliness",
};

const nullableNumber = (v: unknown): number | null =>
  v == null ? null : Number(v);

type HeadlineRow = Record<string, unknown> & {
  votes: string | number;
  overall_avg: string | null;
  fun_avg: string | null;
  overall_stddev: string | null;
  avg_recent_battles: string | null;
  axis_votes: string | number;
  review_count: string | number;
};

/**
 * Everything one map's community panel draws.
 *
 * Four statements rather than one: the headline with its two histograms, the
 * two splits, and the published opinions. They all ride the `arena_id` index,
 * and keeping them apart means the per-row review columns are not dragged
 * through a query that is otherwise pure aggregation.
 *
 * The rollup table is read for one thing only, the shrunk means, which are a
 * fact about every vote on the site rather than about this arena.
 */
export async function getMapRatingSummary(
  arenaId: string,
): Promise<MapRatingSummary> {
  const [headline, splits, regions, reviews, aggregate] = await Promise.all([
    headlineFor(arenaId),
    bracketsFor(arenaId),
    regionsFor(arenaId),
    listMapReviews(arenaId),
    db
      .select({
        overallBayes: mapRatingAggregates.overallBayes,
        funBayes: mapRatingAggregates.funBayes,
      })
      .from(mapRatingAggregates)
      .where(eq(mapRatingAggregates.arenaId, arenaId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const votes = Number(headline.votes);
  const overallStddev = nullableNumber(headline.overall_stddev);

  return {
    arenaId,
    votes,
    overall: nullableNumber(headline.overall_avg),
    fun: nullableNumber(headline.fun_avg),
    // Read from the rollup rather than recomputed: the shrunk mean needs the
    // site-wide prior, which is a fact about every map and not about this one.
    // Null until the cron has run once, which is why the page leads with the
    // plain mean and treats these as the sort key they are.
    overallBayes: aggregate?.overallBayes ?? null,
    funBayes: aggregate?.funBayes ?? null,
    overallStddev,
    consensus: ratingConsensus(overallStddev, votes),
    overallDistribution: starDistribution(starCounts(headline, "o")),
    funDistribution: starDistribution(starCounts(headline, "f")),
    brackets: splits,
    regions,
    axes: axisVerdicts(headline),
    axisVotes: Number(headline.axis_votes),
    avgVoterRecentBattles: nullableNumber(headline.avg_recent_battles),
    reviews,
    reviewCount: Number(headline.review_count),
  };
}

/** The three figures a gallery card and a page heading need, and nothing
 * else. */
export type MapRatingHeadline = {
  overall: number | null;
  votes: number;
  reviewCount: number;
};

/**
 * The verdict in three numbers.
 *
 * Its own read for the same reason the vehicle one is: a caller that only needs
 * a score and a count should not pay for two histograms, two splits, five axis
 * means and thirty review bodies. A single grouped scan of an indexed column.
 */
export async function getMapRatingHeadline(
  arenaId: string,
): Promise<MapRatingHeadline> {
  const [row] = (await db.execute(sql`
    SELECT
      COUNT(*)                                           AS votes,
      AVG(overall)                                       AS overall_avg,
      COUNT(*) FILTER (WHERE review_status = 'approved') AS review_count
    FROM ${mapRatings}
    WHERE arena_id = ${arenaId}
  `)) as unknown as {
    votes: string | number;
    overall_avg: string | null;
    review_count: string | number;
  }[];

  return {
    overall: nullableNumber(row?.overall_avg),
    votes: Number(row?.votes ?? 0),
    reviewCount: Number(row?.review_count ?? 0),
  };
}

/**
 * The headline pass: both means, the spread, both histograms and every axis, in
 * one scan of this arena's rows.
 *
 * Written as raw SQL because it is a dozen conditional aggregates over the same
 * rows, and expressing that through the query builder would be a dozen
 * subqueries or a dozen scans. `FILTER` keeps it a single pass.
 */
async function headlineFor(arenaId: string): Promise<HeadlineRow> {
  // Derived from the scale rather than typed out: a hardcoded list silently
  // loses its top bars the day the scale changes, while everything else here
  // iterates MIN..MAX and would keep working.
  const steps = Array.from(
    { length: MAX_STARS - MIN_STARS + 1 },
    (_, i) => MIN_STARS + i,
  );
  const starCountColumns = steps
    .flatMap((n) => [
      `COUNT(*) FILTER (WHERE overall = ${n}) AS o${n}`,
      `COUNT(*) FILTER (WHERE fun = ${n}) AS f${n}`,
    ])
    .join(",\n      ");

  const axisColumns = MAP_DETAIL_AXES.flatMap((axis) => {
    const column = AXIS_COLUMN[axis];
    return [
      `AVG(${column}) AS ${column}_avg`,
      `COUNT(${column}) AS ${column}_votes`,
    ];
  }).join(",\n      ");

  // The optional axes, as the "did this voter open the detail at all" test
  // below. Built from the same list the columns are, so an axis added later is
  // counted without a second edit here.
  const anyAxis = MAP_DETAIL_AXES.map(
    (axis) => `${AXIS_COLUMN[axis]} IS NOT NULL`,
  ).join("\n           OR ");

  const rows = (await db.execute(sql`
    SELECT
      COUNT(*)                       AS votes,
      AVG(overall)                   AS overall_avg,
      AVG(fun)                       AS fun_avg,
      -- Sample, not population: these votes are a sample of the players who
      -- get sent here, and the difference matters at the vote counts an
      -- unloved arena actually gets.
      STDDEV_SAMP(overall)           AS overall_stddev,
      -- The trailing thirty days rather than the lifetime count, which is the
      -- one figure that says whether this average was formed by people still
      -- playing the game as it is now.
      AVG(player_recent_battles)     AS avg_recent_battles,
      -- How many opened the optional axes at all, which is what decides whether
      -- there is a radar. Every axis is answered independently, so keying this
      -- on one of them would be wrong in both directions: twenty people rating
      -- only Balance would read as nobody, and six rating only Flow would
      -- unlock a radar whose other spokes rested on one answer each.
      COUNT(*) FILTER (
        WHERE ${sql.raw(anyAxis)}
      ) AS axis_votes,
      -- The true number of published opinions. The list below is capped, so
      -- its length is a rendering decision and this is the fact.
      COUNT(*) FILTER (WHERE review_status = 'approved') AS review_count,
      ${sql.raw(starCountColumns)},
      ${sql.raw(axisColumns)}
    FROM ${mapRatings}
    WHERE arena_id = ${arenaId}
  `)) as unknown as HeadlineRow[];

  return rows[0];
}

/** Pull one histogram out of the headline row. */
function starCounts(
  row: HeadlineRow,
  prefix: "o" | "f",
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (let stars = MIN_STARS; stars <= MAX_STARS; stars++) {
    counts[stars] = Number(row[`${prefix}${stars}`] ?? 0);
  }
  return counts;
}

/** Pull the radar out of the headline row, keeping the declared axis order so
 * the shape is the same on every map. */
function axisVerdicts(row: HeadlineRow): MapAxisVerdict[] {
  return MAP_DETAIL_AXES.map((axis) => {
    const column = AXIS_COLUMN[axis];
    return {
      axis,
      value: nullableNumber(row[`${column}_avg`] as string | null),
      votes: Number(row[`${column}_votes`] ?? 0),
    };
  });
}

/**
 * What each slice of the population thinks.
 *
 * The split that earns the feature, and on a map it is often louder than on a
 * tank: an open field that punishes a mistake from eight hundred metres away
 * reads as miserable to someone still learning and as the best map in the game
 * to someone who can use it, and no single average can say that.
 *
 * The bracket was resolved at write time, so this is a group-by on an indexed
 * column rather than a CASE over a nullable float. Every bracket comes back,
 * including the empty ones: a missing bar in a split reads as a different
 * population, and "nobody good has rated this yet" is itself worth seeing.
 *
 * `avgBattles` carries the voters' trailing thirty days rather than a per-arena
 * figure that does not exist, which is the only place this differs from the
 * vehicle split and is why the panel labels that column rather than assuming
 * the reader knows.
 */
async function bracketsFor(arenaId: string): Promise<BracketVerdict[]> {
  const rows = await db
    .select({
      bracket: mapRatings.bracket,
      votes: sql<number>`COUNT(*)`,
      overall: sql<string | null>`AVG(${mapRatings.overall})`,
      fun: sql<string | null>`AVG(${mapRatings.fun})`,
      avgBattles: sql<string | null>`AVG(${mapRatings.playerRecentBattles})`,
    })
    .from(mapRatings)
    .where(eq(mapRatings.arenaId, arenaId))
    .groupBy(mapRatings.bracket);

  const byBracket = new Map(rows.map((r) => [r.bracket as VoterBracket, r]));
  return VOTER_BRACKETS.map((bracket) => {
    const row = byBracket.get(bracket);
    return {
      bracket,
      votes: Number(row?.votes ?? 0),
      overall: nullableNumber(row?.overall),
      fun: nullableNumber(row?.fun),
      avgBattles: nullableNumber(row?.avgBattles),
    };
  });
}

/** The same split by server, for the metas that differ rather than the players
 * who do. Only the servers that actually voted come back: an absent region is
 * not a fact about the map. */
async function regionsFor(arenaId: string): Promise<RegionVerdict[]> {
  const rows = await db
    .select({
      region: mapRatings.region,
      votes: sql<number>`COUNT(*)`,
      overall: sql<string | null>`AVG(${mapRatings.overall})`,
      fun: sql<string | null>`AVG(${mapRatings.fun})`,
    })
    .from(mapRatings)
    .where(eq(mapRatings.arenaId, arenaId))
    .groupBy(mapRatings.region)
    .orderBy(desc(sql`COUNT(*)`));

  // The column is text, because a per-region table cannot be foreign-keyed to
  // an enum, but only the API ever writes it and it writes the session's own
  // region. Narrowed rather than validated for that reason.
  return rows.map((r) => ({
    region: r.region as Region,
    votes: Number(r.votes),
    overall: nullableNumber(r.overall),
    fun: nullableNumber(r.fun),
  }));
}

/**
 * The published opinions on a map, newest first.
 *
 * Signed by a record rather than by a name alone, with the honest caveat that
 * the record is the account's: nothing anywhere proves this author has been
 * sent here. What the columns do prove is that they play, and how recently,
 * which is what separates a verdict on the current layout from one formed
 * before the last rework.
 */
export async function listMapReviews(arenaId: string): Promise<MapReview[]> {
  const rows = await db
    .select({
      id: mapRatings.id,
      nickname: mapRatings.nickname,
      region: mapRatings.region,
      overall: mapRatings.overall,
      fun: mapRatings.fun,
      battles: mapRatings.playerBattles,
      recentBattles: mapRatings.playerRecentBattles,
      winrate: mapRatings.playerWinrate,
      bracket: mapRatings.bracket,
      playerWn8: mapRatings.playerWn8,
      gameVersion: mapRatings.gameVersion,
      review: mapRatings.review,
      createdAt: mapRatings.createdAt,
    })
    .from(mapRatings)
    .where(
      and(
        eq(mapRatings.arenaId, arenaId),
        eq(mapRatings.reviewStatus, TankReviewStatus.Approved),
      ),
    )
    .orderBy(desc(mapRatings.createdAt))
    .limit(REVIEW_LIMIT);

  return rows.flatMap((r) =>
    r.review
      ? [
          {
            id: r.id,
            nickname: r.nickname,
            region: r.region as Region,
            overall: r.overall,
            fun: r.fun,
            battles: r.battles,
            recentBattles: r.recentBattles,
            winrate: r.winrate,
            bracket: (r.bracket as VoterBracket) ?? VoterBracket.Unknown,
            playerWn8: r.playerWn8,
            gameVersion: r.gameVersion,
            body: r.review,
            createdAt: r.createdAt,
          },
        ]
      : [],
  );
}
