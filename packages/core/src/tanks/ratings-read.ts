import { and, desc, eq, sql } from "drizzle-orm";
import {
  DETAIL_AXES,
  MAX_STARS,
  MIN_STARS,
  ratingConsensus,
  starDistribution,
  TankRatingAxis,
  TankReviewStatus,
  tankRatingAggregates,
  tankRatings,
  VOTER_BRACKETS,
  VoterBracket,
  type AxisVerdict,
  type BracketVerdict,
  type RegionVerdict,
  type TankRatingSummary,
  type TankReview,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/**
 * Reading the community's verdict back.
 *
 * Two very different shapes, which is why they are two functions. One vehicle
 * is an indexed group-by that has to produce a histogram, a split by how well
 * the voters play, a split by server and seven axis means, all live, so the
 * page never contradicts a vote cast a second ago. The catalogue is eleven
 * hundred vehicles at once behind a cached render, which is what the rollup
 * table is for.
 *
 * Kept apart from the submission side, which owes nothing to any of this: it
 * checks a record, writes one row and talks to Discord.
 */

/** How many published opinions a tank page carries. Capped rather than
 * paginated: this is a page of verdicts, not a forum, and the ones that do not
 * fit are the ones a reader was never going to reach. */
const REVIEW_LIMIT = 30;

/** The database column each optional axis lives in, so the aggregate query can
 * be written once over the list instead of nine times by hand. */
const AXIS_COLUMN: Record<string, string> = {
  [TankRatingAxis.Firepower]: "firepower",
  [TankRatingAxis.Armour]: "armour",
  [TankRatingAxis.Mobility]: "mobility",
  [TankRatingAxis.GunHandling]: "gun_handling",
  [TankRatingAxis.Concealment]: "concealment",
  [TankRatingAxis.BeginnerFriendliness]: "beginner_friendliness",
  [TankRatingAxis.Versatility]: "versatility",
};

const nullableNumber = (v: unknown): number | null =>
  v == null ? null : Number(v);

type HeadlineRow = Record<string, unknown> & {
  votes: string | number;
  overall_avg: string | null;
  fun_avg: string | null;
  overall_stddev: string | null;
  avg_battles: string | null;
  axis_votes: string | number;
  review_count: string | number;
};

/**
 * Everything one tank's community tab draws.
 *
 * Three statements rather than one: the headline with its two histograms, the
 * splits (by how well the voter plays, and by server), and the published
 * opinions. They all ride the `tank_id` index, and keeping them apart means the
 * per-row review columns are not dragged through a query that is otherwise pure
 * aggregation.
 *
 * The rollup table is read for one thing only, the over/underrated gap, which
 * is a cross-tank comparison this tank's own rows cannot answer.
 */
export async function getTankRatingSummary(
  tankId: number,
): Promise<TankRatingSummary> {
  const [headline, splits, regions, reviews, aggregate] = await Promise.all([
    headlineFor(tankId),
    bracketsFor(tankId),
    regionsFor(tankId),
    listTankReviews(tankId),
    db
      .select({
        overallBayes: tankRatingAggregates.overallBayes,
        funBayes: tankRatingAggregates.funBayes,
        hype: tankRatingAggregates.hype,
        perceived: tankRatingAggregates.perceivedPercentile,
        measured: tankRatingAggregates.measuredPercentile,
      })
      .from(tankRatingAggregates)
      .where(eq(tankRatingAggregates.tankId, tankId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const votes = Number(headline.votes);
  const overallStddev = nullableNumber(headline.overall_stddev);

  return {
    tankId,
    votes,
    overall: nullableNumber(headline.overall_avg),
    fun: nullableNumber(headline.fun_avg),
    // Read from the rollup rather than recomputed: the shrunk mean needs the
    // site-wide prior, which is a fact about every tank and not about this one.
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
    avgVoterBattles: nullableNumber(headline.avg_battles),
    hype: aggregate?.hype ?? null,
    perceivedPercentile: aggregate?.perceived ?? null,
    measuredPercentile: aggregate?.measured ?? null,
    reviews,
    reviewCount: Number(headline.review_count),
  };
}

/** The three figures the tank hero and the Product markup need, and nothing
 * else. */
export type TankRatingHeadline = {
  overall: number | null;
  votes: number;
  reviewCount: number;
};

/**
 * The verdict in three numbers.
 *
 * Its own read because the tank page's layout renders on every tab of every
 * vehicle, and it needs a score and a count. Calling the full summary there
 * meant five queries and a payload carrying two histograms, three splits, seven
 * axis means and thirty review bodies, to print "4.22, 27 votes". This one is a
 * single grouped scan of an indexed column, and it rides the detail payload the
 * layout already fetches rather than adding a second self-fetch to a codebase
 * that has been taken down by those before.
 */
export async function getTankRatingHeadline(
  tankId: number,
): Promise<TankRatingHeadline> {
  const [row] = (await db.execute(sql`
    SELECT
      COUNT(*)                                           AS votes,
      AVG(overall)                                       AS overall_avg,
      COUNT(*) FILTER (WHERE review_status = 'approved') AS review_count
    FROM ${tankRatings}
    WHERE tank_id = ${tankId}
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
 * one scan of this tank's rows.
 *
 * Written as raw SQL because it is fifteen conditional aggregates over the same
 * rows, and expressing that through the query builder would be fifteen
 * subqueries or fifteen scans. `FILTER` keeps it a single pass.
 */
async function headlineFor(tankId: number): Promise<HeadlineRow> {
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

  const axisColumns = DETAIL_AXES.flatMap((axis) => {
    const column = AXIS_COLUMN[axis];
    return [
      `AVG(${column}) AS ${column}_avg`,
      `COUNT(${column}) AS ${column}_votes`,
    ];
  }).join(",\n      ");

  const rows = (await db.execute(sql`
    SELECT
      COUNT(*)                       AS votes,
      AVG(overall)                   AS overall_avg,
      AVG(fun)                       AS fun_avg,
      -- Sample, not population: these votes are a sample of the players who
      -- own the tank, and the difference matters at the vote counts a niche
      -- vehicle actually gets.
      STDDEV_SAMP(overall)           AS overall_stddev,
      AVG(battles)                   AS avg_battles,
      -- How many opened the optional axes at all, which is what decides whether
      -- there is a radar. Every axis is answered independently, so keying this
      -- on one of them was wrong in both directions: twenty people rating only
      -- Mobility read as nobody, and six rating only Firepower unlocked a radar
      -- whose other spokes rested on one answer each. Which spokes have earned
      -- a place is decided per axis, from the counts below.
      COUNT(*) FILTER (
        WHERE firepower IS NOT NULL
           OR armour IS NOT NULL
           OR mobility IS NOT NULL
           OR gun_handling IS NOT NULL
           OR concealment IS NOT NULL
           OR beginner_friendliness IS NOT NULL
           OR versatility IS NOT NULL
      ) AS axis_votes,
      -- The true number of published opinions. The list below is capped, so
      -- its length is a rendering decision and this is the fact.
      COUNT(*) FILTER (WHERE review_status = 'approved') AS review_count,
      ${sql.raw(starCountColumns)},
      ${sql.raw(axisColumns)}
    FROM ${tankRatings}
    WHERE tank_id = ${tankId}
  `)) as unknown as HeadlineRow[];

  return rows[0];
}

/** Pull one histogram out of the headline row. */
function starCounts(row: HeadlineRow, prefix: "o" | "f"): Record<number, number> {
  const counts: Record<number, number> = {};
  for (let stars = MIN_STARS; stars <= MAX_STARS; stars++) {
    counts[stars] = Number(row[`${prefix}${stars}`] ?? 0);
  }
  return counts;
}

/** Pull the radar out of the headline row, keeping the declared axis order so
 * the shape is the same on every tank. */
function axisVerdicts(row: HeadlineRow): AxisVerdict[] {
  return DETAIL_AXES.map((axis) => {
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
 * The reason this whole feature exists: a tank that unicums rate 4.6 and
 * everyone else rates 3.1 is a tank that rewards knowing what you are doing,
 * and no single average can say that. The bracket was resolved at write time,
 * so this is a group-by on an indexed column rather than a CASE over a nullable
 * float.
 *
 * Every bracket comes back, including the empty ones: a missing bar in a split
 * reads as a different population, and "nobody good has rated this yet" is
 * itself worth seeing.
 */
async function bracketsFor(tankId: number): Promise<BracketVerdict[]> {
  const rows = await db
    .select({
      bracket: tankRatings.bracket,
      votes: sql<number>`COUNT(*)`,
      overall: sql<string | null>`AVG(${tankRatings.overall})`,
      fun: sql<string | null>`AVG(${tankRatings.fun})`,
      avgBattles: sql<string | null>`AVG(${tankRatings.battles})`,
    })
    .from(tankRatings)
    .where(eq(tankRatings.tankId, tankId))
    .groupBy(tankRatings.bracket);

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
 * not a fact about the tank. */
async function regionsFor(tankId: number): Promise<RegionVerdict[]> {
  const rows = await db
    .select({
      region: tankRatings.region,
      votes: sql<number>`COUNT(*)`,
      overall: sql<string | null>`AVG(${tankRatings.overall})`,
      fun: sql<string | null>`AVG(${tankRatings.fun})`,
    })
    .from(tankRatings)
    .where(eq(tankRatings.tankId, tankId))
    .groupBy(tankRatings.region)
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
 * The published opinions on a tank, newest first.
 *
 * Signed by a record rather than by a name alone: what makes a review worth
 * reading is not who wrote it but that they have the battles, so the columns
 * that prove it travel with the text. The client holds all of them and can
 * re-sort by experience without another round trip.
 */
export async function listTankReviews(tankId: number): Promise<TankReview[]> {
  const rows = await db
    .select({
      id: tankRatings.id,
      nickname: tankRatings.nickname,
      region: tankRatings.region,
      overall: tankRatings.overall,
      fun: tankRatings.fun,
      battles: tankRatings.battles,
      winrate: tankRatings.winrate,
      avgDamage: tankRatings.avgDamage,
      marksOnGun: tankRatings.marksOnGun,
      bracket: tankRatings.bracket,
      playerWn8: tankRatings.playerWn8,
      gameVersion: tankRatings.gameVersion,
      review: tankRatings.review,
      createdAt: tankRatings.createdAt,
    })
    .from(tankRatings)
    .where(
      and(
        eq(tankRatings.tankId, tankId),
        eq(tankRatings.reviewStatus, TankReviewStatus.Approved),
      ),
    )
    .orderBy(desc(tankRatings.createdAt))
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
            winrate: r.winrate,
            avgDamage: r.avgDamage,
            marksOnGun: r.marksOnGun,
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
