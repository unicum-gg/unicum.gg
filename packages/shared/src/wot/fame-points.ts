import { iconUrl } from "./assets";
import { RatingColor } from "./ratings";

/**
 * The client's Fame Points coin (24x24), from the wot.assets mirror. The
 * client ships it for Frontline, whose currency carries the same name; the
 * Maneuvers event's own interface is a web page outside the client and brings
 * no icon of its own, so this is the one the game itself draws for the name.
 */
export function famePointsIconUrl(): string {
  return iconUrl("fame_point_tiny.png");
}

/**
 * Share of the ranked field each band reaches down to, best first: the
 * percentiles the site's measured ladders land on (MR's pooled thresholds sit
 * at p99/p98/p95/p85/p60/p20/p07/p02), so a colour means the same standing
 * here as on every other board. The last band takes whatever is left.
 */
export const FAME_POINTS_BANDS: readonly (readonly [number, RatingColor])[] = [
  [0.01, RatingColor.Top],
  [0.02, RatingColor.Excellent],
  [0.05, RatingColor.Super],
  [0.15, RatingColor.VeryGood],
  [0.4, RatingColor.Good],
  [0.8, RatingColor.Average],
  [0.93, RatingColor.BelowAvg],
  [0.98, RatingColor.Bad],
  [1, RatingColor.VeryBad],
];

/**
 * Where a place on a Maneuvers board stands, on the site's rating palette.
 *
 * Read off the place's share of the ranked field rather than off the points,
 * because points have no scale of their own: the vehicle line sat at 502 on EU
 * while the top player held 11 times that, and the clan board runs from 0.02x
 * its gold line to 230x. A share is comparable across both boards and every
 * edition. Whether a place is rewarded is the row's own business (past the
 * line it is greyed), so the colour says one thing only.
 */
export function famePointsColor(place: number, ranked: number): RatingColor | null {
  if (ranked <= 0) return null;
  for (const [ceiling, color] of FAME_POINTS_BANDS) {
    if (place <= Math.ceil(ceiling * ranked)) return color;
  }
  return RatingColor.VeryBad;
}

export type FamePointsScaleBand = {
  color: RatingColor;
  /** The share of the field the band reaches down to. */
  share: number;
  fromPlace: number;
  toPlace: number;
};

/**
 * The bands as places on today's board, best first, for the scale a page
 * prints beside it: the same arithmetic as `famePointsColor`, so the legend
 * and the cells cannot disagree. A band too thin to hold a place on a small
 * field is left out rather than printed empty.
 */
export function famePointsScale(ranked: number): FamePointsScaleBand[] {
  if (ranked <= 0) return [];
  const bands: FamePointsScaleBand[] = [];
  let from = 1;
  for (const [share, color] of FAME_POINTS_BANDS) {
    const to = Math.min(Math.ceil(share * ranked), ranked);
    if (to >= from) bands.push({ color, share, fromPlace: from, toPlace: to });
    from = Math.max(from, to + 1);
  }
  return bands;
}
