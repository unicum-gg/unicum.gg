import { RatingColor, RATING_COLOR_HEX } from "./ratings";
import {
  hrColor,
  hrbColor,
  steelHunterWinrateColor,
  strongholdRatingBattlesColor,
  strongholdRatingColor,
  strongholdWinrateColor,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
} from "./ratings";
import { starRatingColor } from "./tank-ratings";

/**
 * Every colour scale the site paints a number with.
 *
 * Named after the quantity rather than the surface, since several are shown in
 * more than one place: a clan's average WN8 and a player's own are the same
 * scale, and reading them off two names would be an invitation to let the two
 * drift apart.
 */
export enum RatingScale {
  Wn7 = "wn7",
  Wn8 = "wn8",
  Wnx = "wnx",
  Winrate = "winrate",
  Hr = "hr",
  Hrb = "hrb",
  SteelHunterWinrate = "steelHunterWinrate",
  StrongholdRating = "strongholdRating",
  StrongholdRatingBattles = "strongholdRatingBattles",
  StrongholdWinrate = "strongholdWinrate",
  StarRating = "starRating",
}

/** One band of a scale, half-open: `from` included, `to` excluded. The first
 * band opens at null and the last closes at null, because both really are
 * unbounded and an invented edge would be read as a real one. */
export type RatingScaleBand = {
  color: RatingColor;
  hex: string;
  from: number | null;
  to: number | null;
};

export type RatingScaleInfo = {
  scale: RatingScale;
  /** What the numbers are, in the API's own units: a win-rate scale is
   * published in percent because that is how the API serves a win rate. */
  unit: RatingScaleUnit;
  bands: RatingScaleBand[];
};

export enum RatingScaleUnit {
  Points = "points",
  /**
   * 0 to 100. The colour functions take a 0..1 fraction, but every win rate the
   * API serves is a percentage, so the bands are published in the unit a caller
   * actually holds. Publishing the fraction instead was a trap: a client doing
   * exactly what this endpoint invites, reading a resolved player's 52.4 and
   * looking it up here, would find it past the top band's 0.65 and paint every
   * player on the roster purple.
   */
  Percent = "percent",
  Stars = "stars",
}

/**
 * How a scale is measured: the function that paints it, the interval its
 * thresholds can lie in, and how finely they are written.
 *
 * `precision` is the smallest step a threshold is expressed with, not a
 * sampling step: the bands are found by bisection, so it only decides where a
 * boundary is rounded to. It has to be no coarser than the real thresholds
 * (win rate is written to the hundredth, star ratings to the twentieth), or a
 * band would be reported at the wrong edge.
 */
const SCALES: Record<
  RatingScale,
  {
    colorOf: (value: number) => RatingColor;
    unit: RatingScaleUnit;
    min: number;
    max: number;
    precision: number;
    /** Multiplier from the colour function's own units to the published ones.
     * Only the win rates need it: they are judged on a fraction and served as a
     * percentage. */
    scaleBy?: number;
    /** Whether `min` is a real floor or only where the search starts. A win
     * rate cannot fall below 0, while a WN8 really can be negative, so only the
     * bounded ones publish a first band with an edge instead of a null. */
    bounded?: boolean;
  }
> = {
  [RatingScale.Wn7]: { colorOf: wn7Color, unit: RatingScaleUnit.Points, min: -2000, max: 10_000, precision: 1 },
  [RatingScale.Wn8]: { colorOf: wn8Color, unit: RatingScaleUnit.Points, min: -2000, max: 10_000, precision: 1 },
  [RatingScale.Wnx]: { colorOf: wnxColor, unit: RatingScaleUnit.Points, min: -2000, max: 10_000, precision: 1 },
  [RatingScale.Winrate]: { colorOf: winrateColor, unit: RatingScaleUnit.Percent, min: 0, max: 1, precision: 0.0001, scaleBy: 100, bounded: true },
  [RatingScale.Hr]: { bounded: true, colorOf: hrColor, unit: RatingScaleUnit.Points, min: 0, max: 5000, precision: 1 },
  [RatingScale.Hrb]: { bounded: true, colorOf: hrbColor, unit: RatingScaleUnit.Points, min: 0, max: 10_000, precision: 1 },
  [RatingScale.SteelHunterWinrate]: { colorOf: steelHunterWinrateColor, unit: RatingScaleUnit.Percent, min: 0, max: 1, precision: 0.0001, scaleBy: 100, bounded: true },
  [RatingScale.StrongholdRating]: { bounded: true, colorOf: strongholdRatingColor, unit: RatingScaleUnit.Points, min: 0, max: 20_000, precision: 1 },
  [RatingScale.StrongholdRatingBattles]: { bounded: true, colorOf: strongholdRatingBattlesColor, unit: RatingScaleUnit.Points, min: 0, max: 40_000, precision: 1 },
  [RatingScale.StrongholdWinrate]: { colorOf: strongholdWinrateColor, unit: RatingScaleUnit.Percent, min: 0, max: 1, precision: 0.0001, scaleBy: 100, bounded: true },
  [RatingScale.StarRating]: { bounded: true, colorOf: starRatingColor, unit: RatingScaleUnit.Stars, min: 0, max: 5, precision: 0.01 },
};

const cache = new Map<RatingScale, RatingScaleInfo>();

/**
 * The bands of one scale, ascending.
 *
 * Read off the colour function itself rather than kept as a second copy of its
 * thresholds, which is what `ratingBands` already does for the three rating
 * metrics and for the same reason: those numbers are written once, in the
 * function, and a table repeating them here would be a table to keep in sync,
 * quietly mislabelling a published scale the day one of them moves.
 *
 * Found by BISECTION rather than by walking the domain a step at a time. Every
 * one of these functions is a ladder of `value < threshold` tests, so it is
 * monotone, and a boundary can be cornered in a few dozen probes instead of
 * however many steps the domain holds. That is what lets one routine serve a
 * scale written in whole points over twelve thousand of them and one written to
 * the hundredth over an interval of 1, with no sampling step to choose per
 * scale and no float accumulated across a long walk.
 */
export function ratingScale(scale: RatingScale): RatingScaleInfo {
  const cached = cache.get(scale);
  if (cached) return cached;

  const { colorOf, unit, min, max, precision, scaleBy = 1, bounded } = SCALES[scale];
  const out = (value: number) => Number((value * scaleBy).toPrecision(12));
  const bands: RatingScaleBand[] = [];
  let from: number | null = bounded ? out(min) : null;
  // The bisection's lower bound, which must always still paint `color`: each
  // boundary found becomes the next search's floor. Restarting from `min` would
  // break that invariant the moment the first band ends, and the search would
  // hand back the same boundary forever.
  let lower = min;
  let color = colorOf(min);

  // A scale cannot have more bands than there are colours, so this bounds the
  // loop on the one thing that is true whatever the thresholds do.
  const limit = Object.keys(RATING_COLOR_HEX).length;
  for (let i = 0; i < limit; i++) {
    const next = boundaryAbove(colorOf, color, lower, max, precision);
    if (next === null) break;
    bands.push({ color, hex: RATING_COLOR_HEX[color], from, to: out(next) });
    from = out(next);
    lower = next;
    color = colorOf(next);
  }
  bands.push({ color, hex: RATING_COLOR_HEX[color], from, to: null });

  const info: RatingScaleInfo = { scale, unit, bands };
  cache.set(scale, info);
  return info;
}

/** Every scale, in declaration order. */
export function ratingScales(): RatingScaleInfo[] {
  return Object.values(RatingScale).map(ratingScale);
}

/**
 * The smallest value above `lo` that no longer paints `color`, or null when the
 * colour holds all the way to `max`.
 *
 * Bisection on a monotone predicate: `lower` still paints the colour and `max`
 * no longer does, so the interval halves until the two are one `precision`
 * apart and the upper bound is the boundary. Rounded to the precision at the end, since a
 * float midpoint lands beside a threshold rather than on it.
 */
function boundaryAbove(
  colorOf: (value: number) => RatingColor,
  color: RatingColor,
  lower: number,
  max: number,
  precision: number,
): number | null {
  if (colorOf(max) === color) return null;
  let lo = lower;
  let hi = max;
  // Converged well BELOW the precision, then snapped onto its grid. Stopping at
  // the precision itself leaves the bound up to a whole step above the real
  // threshold, which rounded 300 up to 301 on every scale written in points.
  const tolerance = precision / 1024;
  while (hi - lo > tolerance) {
    const mid = lo + (hi - lo) / 2;
    if (colorOf(mid) === color) lo = mid;
    else hi = mid;
  }
  return snap(hi, precision);
}

/** The nearest value on the precision's own grid, so a threshold written as
 * 0.47 comes back as 0.47 rather than as 0.4700000000000001, and one written as
 * 300 comes back as 300 rather than as 300.0000001. */
function snap(value: number, precision: number): number {
  const decimals = Math.max(0, Math.ceil(-Math.log10(precision)));
  return Number((Math.round(value / precision) * precision).toFixed(decimals));
}
