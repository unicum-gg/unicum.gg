/** One day on the rating chart (client-safe shapes). The DB-backed series
 * builder (`getRatingHistory`) lives in core (`players/rating-history`).
 *
 * Each point carries all three metrics so the page payload is metric-agnostic
 * (and therefore cacheable): the client picks the active metric from its own
 * rating-metric cookie and reads `lifetime[metric]` / `session[metric]`. */
export type RatingHistoryMetricValues = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

export type RatingHistoryPoint = {
  day: string;
  lifetime: RatingHistoryMetricValues;
  session: RatingHistoryMetricValues;
};

export type RatingHistory = {
  points: RatingHistoryPoint[];
};
