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
