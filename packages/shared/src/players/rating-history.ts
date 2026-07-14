/** One day on the rating chart (client-safe shapes). The DB-backed series
 * builder (`getRatingHistory`) lives in core (`players/rating-history`). */
export type RatingHistoryPoint = {
  day: string;
  lifetime: number | null;
  session: number | null;
};

export type RatingHistory = {
  points: RatingHistoryPoint[];
};
