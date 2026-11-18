import { median, quantile } from "../lib/stats";
import {
  onslaughtBoardRank,
  OnslaughtRank,
  type OnslaughtBoardRank,
} from "./onslaught-ranks";

/**
 * What the Onslaught board says about itself as a whole, computed once over the
 * standings instead of shipped as the standings.
 *
 * Three panels on that page read the board rather than a row of it: who the
 * players of each rank are, what a rank costs, and what a reader's own rating
 * is worth where they stand. Each one was handed the full set, so a page that
 * draws a hundred rows carried three thousand of them, twice (once as the rows
 * and once as the inlined RSC payload the client components take as props). On
 * EU that was 1,679,926 octets of `results` behind a 3,996,734 octet page, and
 * since every prerendered page is held in a 4 GiB LRU store whose entries
 * average 1.3 MB, one Onslaught page evicted three ordinary ones.
 *
 * So the figures are computed where the rows already are. Everything here is
 * either a scalar or bounded by the rank ladder, with two exceptions that
 * depend on what the reader types and are bounded instead by the board's own
 * length: `ratings`, which makes "you are Nth" exact, and the rate samples,
 * which keep the board's own fallback estimator answering exactly what it did
 * when it was handed the rows.
 */
export type OnslaughtAggregates = {
  /** Players holding a place, which is the board's own length. */
  ranked: number;
  /** The rating at the last Legend position: what Legend costs right now. */
  legendPoints: number | null;
  /** The board's floor, which is Champion's threshold, since the board reaches
   * exactly that far. */
  championPoints: number | null;
  /**
   * The newest capture on the board, in unix seconds, and the clock every
   * activity figure is read against rather than the reader's own.
   *
   * Zero for a season we hold no captures of, which is what tells the board to
   * drop its activity chips rather than draw everybody as idle.
   */
  reference: number;
  /** Rows per activity bucket, for the board's chips. */
  activity: Record<OnslaughtActivityBucket, number>;
  /** Rows per rank, for the board's chips. */
  tiers: Record<OnslaughtBoardRank, number>;
  /** Who the players of each rank are. */
  profiles: OnslaughtTierAggregate[];
  /** The rating a player enters the board at, which is Champion's threshold. */
  entryBar: number;
  /** Battles the board's own players had played when they first appeared on it,
   * as a median: the price of qualifying. */
  entryBattles: number;
  /**
   * Quartiles of the season battles of everyone ranked, raw.
   *
   * Not the paces themselves: a pace is battles per day of SEASON, and how many
   * days that is depends on the season curve, which is fetched apart from the
   * board and is allowed to be missing. Dividing by a positive constant is
   * monotonic, so the quantiles survive it and `onslaughtPaces` finishes the
   * arithmetic once the client knows the divisor.
   */
  battleQuantiles: number[];
  /** Every ranked rating, descending, so a reader's own standing is counted
   * rather than interpolated. */
  ratings: number[];
  /**
   * The rating and the measured points per battle of every row we have a rate
   * for, as two parallel arrays ordered by rating.
   *
   * Parallel arrays rather than pairs because this is the one structure here
   * whose length follows the board, and a pair costs its brackets on every row.
   * Bands of equal population were tried first and are not honest at the bottom
   * of the board: a great many players sit exactly at the entry bar having
   * barely moved, so the lowest band reports 0.3 points a battle where reading
   * the neighbourhood above it reports 1.9, and the reader a fallback exists
   * for is precisely the one who has not arrived yet. So the rows are published
   * and `onslaughtNeighbourhoodRate` is the estimator it always was.
   */
  rateRatings: number[];
  ratePerBattle: number[];
};

/** Who the players holding one rank are. The medians the board cannot show,
 * since the standings say where someone placed and nothing about what it took. */
export type OnslaughtTierAggregate = {
  tier: OnslaughtBoardRank;
  players: number;
  /**
   * The median rating these players carry in ordinary battles, per metric.
   *
   * All five rather than the one the reader picked, because the pick lives in a
   * cookie that only the browser can read: a server that chose for them would
   * publish the default reader's figure to everybody.
   */
  ratings: Record<OnslaughtRatingKey, number | null>;
  /** What they had played when they first appeared on the board. */
  entryBattles: number | null;
  /** What they have played over the whole season, which is the figure someone
   * aiming at this rank is really asking for. */
  seasonBattles: number | null;
  /** Days they were actually seen playing. */
  daysPlayed: number | null;
};

/** The metrics a tier profile carries a median of, which are the five the navbar
 * offers. Keyed by the row's own field names so neither side has to map them. */
export type OnslaughtRatingKey = "wn7" | "wn8" | "wnx" | "pr" | "wtr";

const RATING_KEYS: OnslaughtRatingKey[] = ["wn7", "wn8", "wnx", "pr", "wtr"];

/** The ranks the board reaches, best first. It stops at Champion by
 * construction, which is what makes the board's floor that rank's threshold. */
const BOARD_RANKS: readonly OnslaughtBoardRank[] = [
  OnslaughtRank.Legend,
  OnslaughtRank.Champion,
];

/** How recently a ranked player was last seen playing. */
export enum OnslaughtActivityBucket {
  Today = "today",
  Week = "week",
  Idle = "idle",
}

export const ONSLAUGHT_ACTIVITY_BUCKETS = [
  OnslaughtActivityBucket.Today,
  OnslaughtActivityBucket.Week,
  OnslaughtActivityBucket.Idle,
] as const;

const DAY_SECONDS = 86_400;

/** The widths the neighbourhood estimator tries, and the rows it wants inside
 * one before it stops widening. The board's own figures, unchanged. */
const RATE_WIDTHS = [250, 500, 1000, Number.POSITIVE_INFINITY];
const RATE_MIN_SAMPLE = 20;

/** Decimals kept on a published rate. The board prints one, so three is two
 * more than anything a reader can see, and it is what keeps a float like
 * 2.7142857142857144 from costing seventeen characters a row. */
const RATE_PRECISION = 1000;

/** Everything the aggregates are read off one row. Structural rather than the
 * board's own row type, so the server computes them from what it selected and
 * the client types them from what the endpoint published. */
export type OnslaughtAggregateRow = {
  rank: number;
  rating: number;
  battles: number;
  activeDays?: number | null;
  entryBattles?: number | null;
  lastActiveAt?: number | null;
  pointsPerBattle?: number | null;
  wn7?: number | null;
  wn8?: number | null;
  wnx?: number | null;
  pr?: number | null;
  wtr?: number | null;
};

/**
 * Which bucket a row falls in, against a reference instant.
 *
 * Exactly one bucket per row, so selecting several chips is a union and the
 * counts add up to the board.
 *
 * The reference is the board's own newest capture rather than a clock, for two
 * reasons. The page is prerendered and hydrated, so a clock read during render
 * disagrees with itself across that boundary. And if the capture ever stalls, a
 * wall clock would quietly move the whole field to Idle, which reads as everyone
 * having stopped playing rather than as us having stopped looking.
 */
export function onslaughtActivityBucket(
  row: { lastActiveAt?: number | null },
  reference: number,
): OnslaughtActivityBucket {
  if (row.lastActiveAt == null) return OnslaughtActivityBucket.Idle;
  const age = reference - row.lastActiveAt;
  if (age <= DAY_SECONDS) return OnslaughtActivityBucket.Today;
  if (age <= 7 * DAY_SECONDS) return OnslaughtActivityBucket.Week;
  return OnslaughtActivityBucket.Idle;
}

/** The newest capture on the board, which is the clock everything above reads. */
export function onslaughtActivityReference(
  rows: { lastActiveAt?: number | null }[],
): number {
  let newest = 0;
  for (const row of rows) {
    if (row.lastActiveAt != null && row.lastActiveAt > newest) {
      newest = row.lastActiveAt;
    }
  }
  return newest;
}

/**
 * Everything the page's three aggregate panels need, from the whole board.
 *
 * Called once per response, on the rows the endpoint already read to serve a
 * page of them. The thresholds are the season's own, and a season whose ranks
 * the reconcile has not stamped yet simply has no rank to group by, which the
 * panels already render as nothing rather than as zeroes.
 */
export function onslaughtAggregates(
  rows: OnslaughtAggregateRow[],
  thresholds: { elitePosition: number | null; masterPosition: number | null },
): OnslaughtAggregates {
  const reference = onslaughtActivityReference(rows);

  const activity: Record<OnslaughtActivityBucket, number> = {
    [OnslaughtActivityBucket.Today]: 0,
    [OnslaughtActivityBucket.Week]: 0,
    [OnslaughtActivityBucket.Idle]: 0,
  };
  const byTier: Record<OnslaughtBoardRank, OnslaughtAggregateRow[]> = {
    [OnslaughtRank.Legend]: [],
    [OnslaughtRank.Champion]: [],
  };

  // One pass for everything that is a count or a collection, so a board of a
  // few thousand rows is walked once rather than once per figure.
  let legendPoints: number | null = null;
  let championPoints: number | null = null;
  const ratings: number[] = [];
  const positiveRatings: number[] = [];
  const battles: number[] = [];
  const rated: OnslaughtAggregateRow[] = [];
  for (const row of rows) {
    if (reference > 0) activity[onslaughtActivityBucket(row, reference)] += 1;
    const tier = onslaughtBoardRank(row.rank, thresholds);
    if (tier) byTier[tier].push(row);
    if (
      thresholds.elitePosition != null &&
      row.rank === thresholds.elitePosition
    ) {
      legendPoints = row.rating;
    }
    if (championPoints == null || row.rating < championPoints) {
      championPoints = row.rating;
    }
    ratings.push(row.rating);
    if (row.rating > 0) positiveRatings.push(row.rating);
    if (row.battles > 0) battles.push(row.battles);
    if (row.pointsPerBattle != null && row.pointsPerBattle > 0) rated.push(row);
  }

  return {
    ranked: rows.length,
    legendPoints,
    championPoints,
    reference,
    activity,
    tiers: {
      [OnslaughtRank.Legend]: byTier[OnslaughtRank.Legend].length,
      [OnslaughtRank.Champion]: byTier[OnslaughtRank.Champion].length,
    },
    profiles: BOARD_RANKS.map((tier) => tierAggregate(tier, byTier[tier])),
    // The model's own fallback when the board carries no rating at all, kept
    // here so the one place that decides it is the one that publishes it.
    entryBar:
      positiveRatings.length > 0 ? Math.min(...positiveRatings) : 2000,
    entryBattles:
      median(
        rows
          .map((r) => r.entryBattles)
          .filter((v): v is number => v != null && v > 0),
      ) ?? 0,
    battleQuantiles: battleQuantilesOf(battles),
    // Descending, which is the order the board is served in, so the client's
    // count of who is ahead is a walk from the top rather than a sort.
    ratings: ratings.sort((a, b) => b - a),
    rateRatings: rated.map((r) => r.rating),
    ratePerBattle: rated.map(
      (r) => Math.round((r.pointsPerBattle ?? 0) * RATE_PRECISION) / RATE_PRECISION,
    ),
  };
}

function tierAggregate(
  tier: OnslaughtBoardRank,
  rows: OnslaughtAggregateRow[],
): OnslaughtTierAggregate {
  const ratings = {} as Record<OnslaughtRatingKey, number | null>;
  for (const key of RATING_KEYS) {
    ratings[key] = median(
      rows.map((r) => r[key]).filter((v): v is number => v != null),
    );
  }
  return {
    tier,
    players: rows.length,
    ratings,
    entryBattles: median(
      rows
        .map((r) => r.entryBattles)
        .filter((v): v is number => v != null && v > 0),
    ),
    seasonBattles: median(rows.map((r) => r.battles)),
    daysPlayed: median(
      rows.map((r) => r.activeDays).filter((v): v is number => v != null),
    ),
  };
}

/** The quartiles the paces are finished from, raw and unrounded: rounding before
 * the division would round the wrong quantity. */
function battleQuantilesOf(battles: number[]): number[] {
  if (battles.length === 0) return [];
  const sorted = [...battles].sort((a, b) => a - b);
  return [0.25, 0.5, 0.75].map((q) => quantile(sorted, q));
}

/**
 * What the ranked field plays in a day of season, as quartiles.
 *
 * The second half of `battleQuantiles`, applied once the caller knows how many
 * days the season has run. Deduped after rounding, because two quartiles of a
 * board where nearly everyone plays the same amount land on one number and
 * showing it twice reads as a range of one.
 */
export function onslaughtPaces(
  battleQuantiles: number[],
  seasonDays: number | null,
): number[] {
  if (seasonDays == null || seasonDays <= 0) return [];
  return [
    ...new Set(
      battleQuantiles.map((q) => Math.max(1, Math.round(q / seasonDays))),
    ),
  ];
}

/**
 * What a battle is worth to the players sitting where this one is.
 *
 * The fallback for a reader whose own two numbers cannot answer it, which is
 * everyone still under the leaderboard and anyone who has just arrived on it.
 * It is a weak estimator and is only ever the second choice: checked against
 * the players whose real rate we can difference out of the captures, matching
 * on rating alone lands within a factor of two for 57% of them against 77% for
 * reading a player's own record, because two players holding the same rating
 * got there at very different speeds.
 *
 * A rating under the board falls to the lowest band and one over it to the
 * highest, which is the honest answer in both directions: the nearest players
 * we measured are the ones at that end.
 */
export function onslaughtNeighbourhoodRate(
  aggregates: Pick<OnslaughtAggregates, "rateRatings" | "ratePerBattle">,
  points: number,
): number | null {
  const { rateRatings, ratePerBattle } = aggregates;
  if (rateRatings.length === 0) return null;
  for (const width of RATE_WIDTHS) {
    const near: number[] = [];
    for (const [i, rating] of rateRatings.entries()) {
      if (Math.abs(rating - points) <= width) near.push(ratePerBattle[i]);
    }
    if (near.length >= RATE_MIN_SAMPLE) return median(near);
  }
  return median([...ratePerBattle]);
}

/** How many ranked players hold a rating above this one, counted off the
 * descending list rather than estimated from a histogram. */
export function onslaughtRankedAbove(ratings: number[], points: number): number {
  let low = 0;
  let high = ratings.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (ratings[mid] > points) low = mid + 1;
    else high = mid;
  }
  return low;
}
