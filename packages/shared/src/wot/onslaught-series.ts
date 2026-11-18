/**
 * One sample of an Onslaught season's board: what it cost to hold a rank at one
 * instant. The source publishes the present instant and keeps no history, so
 * every one of these exists because we recorded it.
 */
export type OnslaughtSeasonSample = {
  /** Instant of the sample, unix seconds. */
  t: number;
  /** Players holding a place on the board. */
  ranked: number;
  /** Points needed for Legend, Wargaming's own published threshold. */
  legendPoints: number | null;
  /** Points sitting at the Champion position, read off the board. */
  championPoints: number | null;
  topRating: number | null;
  /** The last ranked player's rating: the real price of entry. */
  minRating: number | null;
  /** Battles summed over every ranked player, the mode's activity. */
  battles: number | null;
};

/**
 * A season's whole curve, one array per field rather than one object per
 * sample.
 *
 * **The field names were 63% of this payload.** A season is captured every five
 * minutes, which is 8,462 samples over thirty-eight days on EU, and writing
 * `"championPoints":` on each of them came to 668,498 octets of the 1,055,355
 * the curve took, against 310,698 of actual numbers. The page carries the whole
 * curve because the chart draws the whole season and the Legend projection is
 * fitted over it, so there is nothing here to leave out: there is only a way to
 * write it down that does not repeat seven words per five minutes of season.
 *
 * It is the transport shape only. `onslaughtSamples` turns it back into the
 * samples every consumer already reads, once, where the payload arrives.
 */
export type OnslaughtSeasonSeries = {
  t: number[];
  ranked: number[];
  legendPoints: (number | null)[];
  championPoints: (number | null)[];
  topRating: (number | null)[];
  minRating: (number | null)[];
  battles: (number | null)[];
};

/** The series as the endpoint publishes it, from the rows it read. */
export function onslaughtSeries(
  samples: OnslaughtSeasonSample[],
): OnslaughtSeasonSeries {
  return {
    t: samples.map((s) => s.t),
    ranked: samples.map((s) => s.ranked),
    legendPoints: samples.map((s) => s.legendPoints),
    championPoints: samples.map((s) => s.championPoints),
    topRating: samples.map((s) => s.topRating),
    minRating: samples.map((s) => s.minRating),
    battles: samples.map((s) => s.battles),
  };
}

/**
 * The samples back, in the order they were captured.
 *
 * Driven by `t`, which is the one field every sample has: a shorter column
 * would otherwise silently decide the length of the curve. A column that does
 * not reach a sample reads as null, which is what an absent threshold already
 * means everywhere this is drawn.
 */
export function onslaughtSamples(
  series: OnslaughtSeasonSeries,
): OnslaughtSeasonSample[] {
  return series.t.map((t, i) => ({
    t,
    ranked: series.ranked[i] ?? 0,
    legendPoints: series.legendPoints[i] ?? null,
    championPoints: series.championPoints[i] ?? null,
    topRating: series.topRating[i] ?? null,
    minRating: series.minRating[i] ?? null,
    battles: series.battles[i] ?? null,
  }));
}
