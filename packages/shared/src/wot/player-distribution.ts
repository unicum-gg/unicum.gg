import type { Region, VehicleType } from "@unicum.gg/wargaming";
import { RatingMetric } from "../constants/rating";
import { type RatingColor, wn7Color, wn8Color, wnxColor } from "./ratings";

/**
 * How the region's tracked players are spread across win rate and WNX, and how
 * its battles are spread across tiers and vehicle types.
 *
 * The client-safe shapes and the pure arithmetic over them. The queries live in
 * core (`players/distribution`), which is also where the cron that materialises
 * them runs.
 */

/**
 * Battles an account needs before it counts.
 *
 * A hundred rather than none, because an account with three battles has a win
 * rate of 0, 33, 67 or 100 and would pile up in the histogram's tails as if
 * those were real skill levels. Rather than a thousand, because the cut barely
 * moves the answer (the region's mean win rate is 0.4869 at a hundred battles
 * and 0.4880 at a thousand) while it would drop 330,000 accounts that have
 * genuinely played.
 */
export const DISTRIBUTION_MIN_BATTLES = 100;

/** Win-rate histogram: one-point steps across the range every real player sits
 * in, with everything outside collected in the two edge buckets. */
export const WINRATE_RANGE = { min: 0.3, max: 0.7, steps: 40 } as const;

/**
 * Rating histograms: hundred-wide steps, one range per metric.
 *
 * Each stops just past its own 99th percentile (WN7 1835, WN8 2934, WNX 2801 on
 * EU), so every range holds all but a rounding error of the population and its
 * last bucket stays a tail rather than a wall. WN7 is a shorter scale than the
 * other two and gets a shorter axis rather than thirty columns of nothing.
 */
export const RATING_RANGES: Record<
  RatingMetric,
  { min: number; max: number; steps: number }
> = {
  [RatingMetric.Wn7]: { min: 0, max: 2000, steps: 20 },
  [RatingMetric.Wn8]: { min: 0, max: 3000, steps: 30 },
  [RatingMetric.Wnx]: { min: 0, max: 3000, steps: 30 },
};

/** The band a value of each metric wears, so a histogram can be coloured by
 * whichever metric the reader has selected without a switch at every use. */
export const RATING_COLOR_OF: Record<
  RatingMetric,
  (value: number) => RatingColor
> = {
  [RatingMetric.Wn7]: wn7Color,
  [RatingMetric.Wn8]: wn8Color,
  [RatingMetric.Wnx]: wnxColor,
};

/** The domain a value can take at all, so the two edge buckets have real edges
 * to be measured against rather than an infinity. */
export const WINRATE_DOMAIN = { min: 0, max: 1 } as const;
/**
 * A rating's floor is below zero, not at it. WN7's formula subtracts a
 * low-tier penalty from an already small number and genuinely goes negative
 * (1,699 EU accounts do, down to -316), so a domain starting at zero left the
 * underflow bucket spanning nothing, and those players were dropped from the
 * histogram while still counted in the population it is measured against.
 */
export const RATING_DOMAIN = { min: -2000, max: 10_000 } as const;

/**
 * One column of a histogram, half-open: `from` included, `to` excluded. The
 * first and last of a series are the overflow buckets, so they are wider than
 * the rest and should be drawn as such rather than pretending to be one step.
 */
export type DistributionBucket = { from: number; to: number; count: number };

/** The battles a tier or a vehicle type accounts for across the region. */
export type BattleShare = {
  /** Vehicles of this kind the region has tracked stats for. */
  tanks: number;
  battles: number;
  /** Battle-weighted mean win rate, 0..1. */
  winrate: number;
};

/** One histogram per rating metric, so the page can follow the metric the
 * reader picked in the navbar instead of naming one for them. */
export type RatingDistributions = Record<RatingMetric, DistributionBucket[]>;

export type TierShare = BattleShare & { tier: number };
export type TypeShare = BattleShare & { type: VehicleType };

export type PlayerDistribution = {
  region: Region;
  /** The threshold the histograms were built with, so the page can say what
   * population it is describing rather than implying it is everyone. */
  minBattles: number;
  /** Accounts that met it. */
  players: number;
  winrate: DistributionBucket[];
  ratings: RatingDistributions;
  byTier: TierShare[];
  byType: TypeShare[];
  /** When the aggregate was last recomputed, null before the first run. */
  computedAt: Date | null;
};

/** The edges of a histogram, overflow buckets included. Shared by the query
 * that fills the buckets and the reader that draws them, so a bucket index
 * means the same thing on both sides. */
export function bucketEdges(
  range: { min: number; max: number; steps: number },
  domain: { min: number; max: number },
): { from: number; to: number }[] {
  // Rounded, because a win-rate step of 0.01 accumulated in binary gives edges
  // like 0.32999999999999996. The drift is far below anything the histogram
  // measures, but these edges are stored and served, and a bucket that says it
  // ends at 0.32999999999999996 reads as a bug in the data rather than as the
  // 33% it is.
  const edge = (i: number) =>
    Number((range.min + (i * (range.max - range.min)) / range.steps).toFixed(10));
  const edges: { from: number; to: number }[] = [
    { from: domain.min, to: range.min },
  ];
  for (let i = 0; i < range.steps; i++) {
    edges.push({ from: edge(i), to: edge(i + 1) });
  }
  edges.push({ from: range.max, to: domain.max });
  return edges;
}

/**
 * Where a value falls in the population, as a share between 0 and 1.
 *
 * Interpolated inside the bucket that holds it rather than counting the whole
 * bucket as below or above, so two players a point apart do not come back with
 * the same percentile just because they share a column. Null when there is
 * nothing to compare against.
 */
export function percentileOf(
  buckets: DistributionBucket[],
  value: number,
): number | null {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) return null;

  let below = 0;
  for (const bucket of buckets) {
    if (value >= bucket.to) {
      below += bucket.count;
      continue;
    }
    if (value > bucket.from) {
      const span = bucket.to - bucket.from;
      below += span > 0 ? (bucket.count * (value - bucket.from)) / span : 0;
    }
    break;
  }
  return Math.min(1, Math.max(0, below / total));
}

/** The bucket a value belongs to, for highlighting the reader's own column. */
export function bucketIndexOf(
  buckets: DistributionBucket[],
  value: number,
): number {
  for (let i = 0; i < buckets.length; i++) {
    if (value < buckets[i].to) return i;
  }
  return buckets.length - 1;
}

/** Total battles across a breakdown, so a share can be read against it. */
export function totalBattles(shares: BattleShare[]): number {
  return shares.reduce((sum, s) => sum + s.battles, 0);
}
