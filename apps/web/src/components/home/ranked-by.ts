import { isWnRatingMetric, type RatingMetric } from "@unicum.gg/shared";

/**
 * The `ranked-by` line for a board over `window`. A WN rating is the window's
 * own, while PR and WTR are account figures with no value over one (see
 * `RatingMetric`), so their board ranks the players active inside it by their
 * current figure and its line has to say that rather than "over the past 24
 * hours".
 *
 * Not a client module, so the server-rendered home page can call it too.
 */
export function rankedByKey<W extends string>(
  window: W,
  metric: RatingMetric,
): W | `${W}-account` {
  return isWnRatingMetric(metric) ? window : `${window}-account`;
}
