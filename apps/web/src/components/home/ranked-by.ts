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

/**
 * A home board's window, valued as the API's own `period`.
 *
 * It is an enum here rather than a string beside each panel because the client
 * board needs it twice: to write its `ranked-by` line, and to ask the endpoint
 * for another metric's rows when the reader picked one the static page was not
 * built with. It lives in this module, which carries no `"use client"`, so the
 * server-rendered home page can name a window without being handed a client
 * reference instead of a value (see `constants/pagination`).
 */
export enum HomeWindow {
  Day = "24h",
  Week = "7d",
  Month = "30d",
  Overall = "overall",
}

/** The word the lines are keyed by, which is not the endpoint's value: the
 * catalogue says "day" where the API says "24h". */
const WINDOW_WORD: Record<HomeWindow, string> = {
  [HomeWindow.Day]: "day",
  [HomeWindow.Week]: "week",
  [HomeWindow.Month]: "month",
  [HomeWindow.Overall]: "overall",
};

/** The `ranked-by` line for one of the home's boards. Lifetime has a line of
 * its own, since there is no window for a rating to be read over. */
export function homeRankedByKey(window: HomeWindow, metric: RatingMetric): string {
  return window === HomeWindow.Overall
    ? "overall"
    : rankedByKey(WINDOW_WORD[window], metric);
}
