import { RatingColor } from "@unicum.gg/shared";

/** Each rating band's key under `tiers.` in `components/home/rating-scale`,
 * the one vocabulary every scale table names its colours with. */
export const RATING_BAND_KEY: Record<RatingColor, string> = {
  [RatingColor.VeryBad]: "very-bad",
  [RatingColor.Bad]: "bad",
  [RatingColor.BelowAvg]: "below-avg",
  [RatingColor.Average]: "average",
  [RatingColor.Good]: "good",
  [RatingColor.VeryGood]: "very-good",
  [RatingColor.Super]: "super",
  [RatingColor.Excellent]: "excellent",
  [RatingColor.Top]: "top",
};
