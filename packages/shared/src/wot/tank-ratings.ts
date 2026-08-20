import type { Region } from "@unicum.gg/wargaming";
import { RatingColor } from "./ratings";
import {
  DETAIL_AXES,
  MAX_STARS,
  MIN_STARS,
  TankRatingAxis,
  VoterBracket,
} from "../db/schema/tank-ratings";

/**
 * The maths behind the community's verdict on a vehicle, and the shapes the API
 * hands it back in.
 *
 * Pure and client-safe: the tank page draws the same numbers the aggregate cron
 * ranks on, so both read them from here rather than each rounding a mean their
 * own way.
 */

/**
 * How many votes it takes for a tank's own average to outweigh the site's.
 *
 * A five-star mean sorted descending is a leaderboard of tanks three people
 * have rated. The fix is the standard one: pretend every vehicle arrives with
 * `RATING_PRIOR_WEIGHT` votes at the site-wide mean and let real votes pull it
 * away from there, so a verdict has to be earned before it can top a board.
 *
 * Twenty is deliberately low. It is enough to bury a four-vote tank and light
 * enough that a niche vehicle with sixty honest votes still reads as itself.
 */
export const RATING_PRIOR_WEIGHT = 20;

/**
 * The shrinkage itself lives in SQL, in `refreshTankRatingAggregates`: it needs
 * the site-wide prior, which is a fact about every vote in the table and not
 * about one tank, so it is computed in the same pass that reads them. There is
 * deliberately no TypeScript twin here. One existed, nothing called it, and a
 * second implementation of a formula only has to drift once.
 */

/**
 * Where a five-star score sits on the site's own colour ladder, so a community
 * verdict is painted with the same steps as every rating on the site rather
 * than inventing a second palette.
 *
 * Eight of the nine steps, not all nine: `VeryBad` is pure black, which is the
 * right bottom for a WN8 scale that runs to zero and the wrong one for a scale
 * whose floor is one star. A one-star bar came out invisible against a dark
 * background, and "the worst score a human can give" is a red, not an absence.
 * The site's own tank tables skip the same step for the same reason.
 *
 * The mapping is not linear across the range on purpose: star averages pile up
 * between 2.5 and 4.5, and spreading the good half over more steps is what
 * makes two well-liked tanks distinguishable at a glance. Three, the dead
 * middle of the scale, lands on `Average`.
 */
export function starRatingColor(value: number): RatingColor {
  if (value < 2.0) return RatingColor.Bad;
  if (value < 2.75) return RatingColor.BelowAvg;
  if (value < 3.25) return RatingColor.Average;
  if (value < 3.65) return RatingColor.Good;
  if (value < 4.05) return RatingColor.VeryGood;
  if (value < 4.35) return RatingColor.Super;
  if (value < 4.6) return RatingColor.Excellent;
  return RatingColor.Top;
}

/**
 * Collapse a written opinion to what will be stored and shown.
 *
 * Pure, and shared with the form on purpose. The server normalises before it
 * measures, so a client counting raw characters lets somebody write eighty-two
 * characters of double-spaced prose, enables the button, and gets back a 400 on
 * a review that looked complete. Both sides count the same string now.
 *
 * Not an escaping pass: React renders this as text, never as markup. It exists
 * so a review is one block of prose rather than an ASCII drawing, and so the
 * length bounds are measured on what a reader actually sees.
 */
export function normalizeReview(raw: string): string {
  return raw
    // Control characters, which no keyboard produces on purpose.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // Any run of blank lines becomes one paragraph break, and other runs of
    // whitespace become a single space.
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether a number is a legal star value. Used at the API boundary, where the
 * body is untrusted. */
export function isStarValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_STARS &&
    value <= MAX_STARS
  );
}

/**
 * How far apart the community sits on a vehicle.
 *
 * The average is the least interesting thing about a divisive tank: 3.0 from
 * everyone agreeing it is mediocre and 3.0 from half the server loving it are
 * different facts, and only one of them is worth a badge.
 */
export enum RatingConsensus {
  /** Everyone says roughly the same thing. */
  Agreed = "agreed",
  Mixed = "mixed",
  /** The votes pile up at both ends. */
  Divisive = "divisive",
}

export const RATING_CONSENSUS_LABEL: Record<RatingConsensus, string> = {
  [RatingConsensus.Agreed]: "Broad agreement",
  [RatingConsensus.Mixed]: "Mixed opinions",
  [RatingConsensus.Divisive]: "Divisive",
};

/**
 * Read the spread of a five-star distribution. Thresholds are on the standard
 * deviation: on a 1 to 5 scale, a sigma under 0.8 is a crowd agreeing and one
 * past 1.25 only happens when the ones and the fives are both well populated.
 * Null under ten votes, where a spread is noise rather than a disagreement.
 */
export function ratingConsensus(
  stddev: number | null,
  votes: number,
): RatingConsensus | null {
  if (stddev == null || votes < 10) return null;
  if (stddev < 0.8) return RatingConsensus.Agreed;
  if (stddev < 1.25) return RatingConsensus.Mixed;
  return RatingConsensus.Divisive;
}

/**
 * The gap between what players think of a tank and what it actually does.
 *
 * Both sides are percentiles inside the vehicle's own tier, so the subtraction
 * means something: comparing a tier II's win rate to a tier X's would say
 * nothing at all. Positive is a tank the community likes more than its results
 * justify, negative is one nobody gives credit to.
 */
export enum RatingHype {
  Overrated = "overrated",
  Fair = "fair",
  Underrated = "underrated",
}

export const RATING_HYPE_LABEL: Record<RatingHype, string> = {
  [RatingHype.Overrated]: "Overrated",
  [RatingHype.Fair]: "Fairly rated",
  [RatingHype.Underrated]: "Underrated",
};

/** A quarter of the tier apart is where the gap stops being measurement noise
 * and starts being a disagreement worth naming. */
export const HYPE_THRESHOLD = 0.25;

export function ratingHype(hype: number | null): RatingHype | null {
  if (hype == null) return null;
  if (hype > HYPE_THRESHOLD) return RatingHype.Overrated;
  if (hype < -HYPE_THRESHOLD) return RatingHype.Underrated;
  return RatingHype.Fair;
}

/**
 * Why a signed-in account cannot rate a tank yet.
 *
 * Lives here rather than next to the check that produces it because the form is
 * what has to say it: "you need 25 battles on it" and "we have not seen your
 * garage yet" are two very different things to be told, and only one of them is
 * worth waiting on.
 */
export enum RatingBlock {
  /** We have never snapshotted this account, so we cannot see any record. A
   * refresh is queued on the spot and the answer changes on its own. */
  NoRecord = "no_record",
  /** Known account, but this vehicle is not in their garage record. */
  NeverPlayed = "never_played",
  /** Played, but not enough of it to have formed a view worth averaging. */
  TooFewBattles = "too_few_battles",
}

export const RATING_BLOCK_MESSAGE: Record<RatingBlock, string> = {
  [RatingBlock.NoRecord]:
    "We have not read your garage yet. We just asked Wargaming for it, so try again in a moment.",
  [RatingBlock.NeverPlayed]: "You have not played this tank.",
  [RatingBlock.TooFewBattles]:
    "You have played it, but not enough of it yet.",
};

/** One bar of the five-star histogram. */
export type StarDistribution = {
  /** 1 to 5. */
  stars: number;
  votes: number;
  /** Share of the total, 0 to 1, so the bar needs no division at render. */
  share: number;
};

/** What one slice of the population thinks, next to how many of them said it. */
export type BracketVerdict = {
  bracket: VoterBracket;
  votes: number;
  overall: number | null;
  fun: number | null;
  /** Mean battles those voters have on the tank, which is what makes the slice
   * credible or not. */
  avgBattles: number | null;
};

/** One axis of the radar: the community mean and how many answered it. */
export type AxisVerdict = {
  axis: TankRatingAxis;
  value: number | null;
  votes: number;
};

/**
 * What one server thinks, on its own.
 *
 * The headline average is global, because a tank is the same tank everywhere
 * and splitting the votes three ways would leave three averages nobody should
 * trust. The split is still worth showing: the servers play different metas,
 * and a vehicle the EU crowd rates a full star above NA is saying something
 * about how it is played rather than about how it is built.
 */
export type RegionVerdict = {
  region: Region;
  votes: number;
  overall: number | null;
  fun: number | null;
};

/** A published written opinion, signed by a record rather than by a username
 * alone: what makes it worth reading is that the person has the battles. */
export type TankReview = {
  id: number;
  nickname: string;
  region: Region;
  /** The author's own stars, so the text is read next to the verdict it
   * explains. */
  overall: number;
  fun: number;
  battles: number;
  winrate: number | null;
  avgDamage: number | null;
  marksOnGun: number | null;
  bracket: VoterBracket;
  playerWn8: number | null;
  gameVersion: string | null;
  body: string;
  createdAt: Date;
};

/** Everything the tank page's community tab draws. */
export type TankRatingSummary = {
  tankId: number;
  votes: number;
  /** The plain means, which is what "4.29" on a card means to a reader. */
  overall: number | null;
  fun: number | null;
  /** The shrunk means, which is what the boards rank on. Shown as the sort key
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
  axes: AxisVerdict[];
  /** How many filled in the optional axes, so the radar can say what it rests
   * on rather than looking as solid as the headline number. */
  axisVotes: number;
  /** Mean battles on the tank across everyone who voted. The one number that
   * says whether this average was formed by people who play it. */
  avgVoterBattles: number | null;
  hype: number | null;
  perceivedPercentile: number | null;
  measuredPercentile: number | null;
  /** Published written opinions, capped: this is a page of verdicts, not a
   * forum. */
  reviews: TankReview[];
  /** How many there are in total, which is not `reviews.length` once the cap
   * bites. Stated separately because `reviewCount` in the page's structured
   * data has to be the real number, not the number we chose to render. */
  reviewCount: number;
};

/** Turn per-star counts into bars, keeping every step so an empty one still
 * draws (a histogram with a missing bar reads as a different distribution). */
export function starDistribution(
  counts: Record<number, number>,
): StarDistribution[] {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const out: StarDistribution[] = [];
  for (let stars = MAX_STARS; stars >= MIN_STARS; stars--) {
    const votes = counts[stars] ?? 0;
    out.push({ stars, votes, share: total > 0 ? votes / total : 0 });
  }
  return out;
}

/** Whether a summary carries a usable radar. Below this the axis means are one
 * person's opinion drawn as a shape, which reads as far more authoritative than
 * it is. */
export const MIN_AXIS_VOTES = 5;

/**
 * The axes worth drawing for a tank, in their declared order.
 *
 * Gated per axis, not on the tank as a whole. Every axis is optional on its
 * own, so a vehicle can easily end up with forty answers on Mobility and one on
 * Concealment, and a spoke drawn from that one answer reads exactly as
 * authoritative as the other six. The tank-level count decides whether there is
 * a radar at all; this decides which spokes have earned a place on it.
 */
export function drawableAxes(axes: AxisVerdict[]): AxisVerdict[] {
  const byAxis = new Map(axes.map((a) => [a.axis, a]));
  return DETAIL_AXES.map((axis) => byAxis.get(axis)).filter(
    (a): a is AxisVerdict =>
      Boolean(a) && a!.value != null && a!.votes >= MIN_AXIS_VOTES,
  );
}
