import type { Region } from "@unicum.gg/wargaming";
import { MAP_DETAIL_AXES, MapRatingAxis } from "../../db/schema/map-ratings";
import type { VoterBracket } from "../../db/schema/tank-ratings";
import { MIN_AXIS_VOTES } from "../tank-ratings";
import type {
  BracketVerdict,
  RatingConsensus,
  RegionVerdict,
  StarDistribution,
} from "../tank-ratings";

/**
 * The shapes the API hands a map's community verdict back in.
 *
 * There is deliberately almost no maths here. Everything a five-star average
 * needs, the colour ladder (`starRatingColor`), the spread reading
 * (`ratingConsensus`), the histogram builder (`starDistribution`), the review
 * normaliser (`normalizeReview`), the star guard (`isStarValue`) and the
 * shrinkage prior (`RATING_PRIOR_WEIGHT`), already exists in `wot/tank-ratings`
 * and is imported from there by every consumer rather than restated. A second
 * implementation of one of those formulas would only have to drift once, and
 * the two features would then paint the same score two colours.
 *
 * What this file owns is the handful of shapes that genuinely differ: the axes
 * are a map's own, and a review is signed with an account record rather than
 * with a record on one vehicle.
 */

/** One spoke of the radar: the community mean on one map axis, and how many
 * answered it. Its own type rather than the vehicle's `AxisVerdict` only
 * because `axis` is typed to the map's axis enum. */
export type MapAxisVerdict = {
  axis: MapRatingAxis;
  value: number | null;
  votes: number;
};

/**
 * A published written opinion about a map.
 *
 * Signed by a record, like a vehicle review, but necessarily a different one:
 * there is no per-arena record to print, so what travels with the text is what
 * the author has done in the game as a whole. The trailing thirty days are the
 * column that carries the weight here, and they are the reason the field
 * exists: a map is reworked between updates, so "two thousand battles, nine
 * hundred of them this month" and "two thousand battles, none since 2019" are
 * very different claims about the layout as it stands.
 */
export type MapReview = {
  id: number;
  nickname: string;
  region: Region;
  /** The author's own stars, so the text is read next to the verdict it
   * explains. */
  overall: number;
  fun: number;
  /** Lifetime battles on the account, which is what the gate was decided on. */
  battles: number | null;
  /** Battles in their trailing thirty days: whether this is an opinion about
   * the map as it is now. */
  recentBattles: number | null;
  winrate: number | null;
  bracket: VoterBracket;
  playerWn8: number | null;
  gameVersion: string | null;
  body: string;
  createdAt: Date;
};

/** Everything a map page's community panel draws. */
export type MapRatingSummary = {
  arenaId: string;
  votes: number;
  /** The plain means, which is what "4.29" under a minimap means to a
   * reader. */
  overall: number | null;
  fun: number | null;
  /** The shrunk means, which is what the board ranks on. Shown as the sort key
   * rather than as the headline, so the page never contradicts the table that
   * links to it. */
  overallBayes: number | null;
  funBayes: number | null;
  overallStddev: number | null;
  consensus: RatingConsensus | null;
  overallDistribution: StarDistribution[];
  funDistribution: StarDistribution[];
  brackets: BracketVerdict[];
  regions: RegionVerdict[];
  axes: MapAxisVerdict[];
  /** How many filled in the optional axes, so the radar can say what it rests
   * on rather than looking as solid as the headline number. */
  axisVotes: number;
  /** Mean trailing-30-day battles across everyone who voted. The one number
   * that says whether this average was formed by people still playing. */
  avgVoterRecentBattles: number | null;
  /** Published written opinions, capped: this is a panel of verdicts, not a
   * forum. */
  reviews: MapReview[];
  /** How many there are in total, which is not `reviews.length` once the cap
   * bites. Stated separately because the page's structured data has to publish
   * the real number, not the number we chose to render. */
  reviewCount: number;
};

/**
 * The axes worth drawing for a map, in their declared order.
 *
 * Gated per axis rather than on the map as a whole, the same rule the vehicle
 * radar landed on after getting it wrong in both directions: every axis is
 * optional on its own, so an arena can easily end up with forty answers on
 * Balance and one on Flow, and a spoke drawn from that one answer reads exactly
 * as authoritative as the other four. The map-level count decides whether there
 * is a radar at all; this decides which spokes have earned a place on it.
 *
 * `MIN_AXIS_VOTES` is imported rather than re-chosen: five is five for the same
 * reason in both features.
 */
export function drawableMapAxes(axes: MapAxisVerdict[]): MapAxisVerdict[] {
  const byAxis = new Map(axes.map((a) => [a.axis, a]));
  return MAP_DETAIL_AXES.map((axis) => byAxis.get(axis)).filter(
    (a): a is MapAxisVerdict =>
      Boolean(a) && a!.value != null && a!.votes >= MIN_AXIS_VOTES,
  );
}
