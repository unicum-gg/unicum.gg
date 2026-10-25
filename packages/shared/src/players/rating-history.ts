/** One day on the rating chart (client-safe shapes). The DB-backed series
 * builder (`getRatingHistory`) lives in core (`players/rating-history`).
 *
 * Each point carries every metric so the page payload is metric-agnostic
 * (and therefore cacheable): the client picks the active metric from its own
 * rating-metric cookie and reads `lifetime[metric]` / `session[metric]`.
 *
 * PR and WTR are Wargaming's account figures, read off the player snapshot
 * standing at the end of each day. They have no session value (a difference
 * between two readings of a career figure is not a rating of the battles in
 * between) and no value on one vehicle, so those are always null. */
export type RatingHistoryMetricValues = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  pr: number | null;
  wtr: number | null;
};

export type RatingHistoryPoint = {
  day: string;
  lifetime: RatingHistoryMetricValues;
  session: RatingHistoryMetricValues;
};

export type RatingHistory = {
  points: RatingHistoryPoint[];
};
