import { StrongholdPeriod } from "./stronghold";

/**
 * Primary rating metric the user wants surfaced across the site. Stored in
 * a cookie via `STORAGE.COOKIES.RATING` and broadcast to every consumer
 * through `useCookie`. WNX is the default (it is unicum.gg's signature
 * metric); users can switch to the older WN8 or WN7 from the navbar.
 */
export enum RatingMetric {
  Wn7 = "wn7",
  Wn8 = "wn8",
  Wnx = "wnx",
}

export const RATING_METRICS: RatingMetric[] = [
  RatingMetric.Wn7,
  RatingMetric.Wn8,
  RatingMetric.Wnx,
];

export const RATING_METRIC_LABEL: Record<RatingMetric, string> = {
  [RatingMetric.Wn7]: "WN7",
  [RatingMetric.Wn8]: "WN8",
  [RatingMetric.Wnx]: "WNX",
};

export const DEFAULT_RATING_METRIC: RatingMetric = RatingMetric.Wnx;

export function isRatingMetric(value: string): value is RatingMetric {
  return (RATING_METRICS as readonly string[]).includes(value);
}

export function ratingMetricFromCookie(
  raw: string | null | undefined,
): RatingMetric {
  return raw && isRatingMetric(raw) ? raw : DEFAULT_RATING_METRIC;
}

/**
 * Battles a player needs inside a leaderboard's window to be ranked on it.
 *
 * Keyed by the site's four-window axis (named for the stronghold boards that
 * needed it first, see `useStatsPeriod`), whose values are the API's `period`
 * and the period cookie alike, so a client can state the floor of the board it
 * is showing without importing the server enum. The recent floors scale with the window so a ranking is not won on a
 * handful of lucky games.
 */
export const TOP_PLAYERS_MIN_BATTLES: Record<StrongholdPeriod, number> = {
  [StrongholdPeriod.Day]: 20,
  [StrongholdPeriod.Week]: 140,
  [StrongholdPeriod.Month]: 600,
  [StrongholdPeriod.Overall]: 20000,
};
