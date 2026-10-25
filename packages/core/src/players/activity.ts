import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import {
  ACTIVITY_WINDOW_DAYS,
  ACTIVITY_WINDOWS,
  type ActivityBand,
  type ActivityPoint,
  ActivityWindow,
  DISTRIBUTION_MIN_BATTLES,
  type NewPlayerActivity,
  type PlayerActivity,
  playerActivityByRegion,
  playersByRegion,
  RATING_METRICS,
  type RatingBand,
  RatingMetric,
  ratingBands,
  type RatingColor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/**
 * Whether a band of the region's players is still playing, recorded daily.
 *
 * The histograms in `./distribution` count accounts per band, which says how
 * many players reached a level and nothing about whether they still log in.
 * This counts who turned up, so the page can answer which band is the most
 * active and whether that is changing.
 *
 * It keeps its own scan rather than riding the histograms' one. The two could
 * share a `MATERIALIZED` CTE, and the 400ms that would save per region per hour
 * is real but not worth what it costs to get: the histogram rows are
 * (metric, bucket, count) and these are (metric, band, twelve counters), so a
 * `UNION ALL` would mean padding one shape into the other and reading a bucket
 * index out of a band column. Nothing cross-reads the two payloads either (one
 * is keyed by hundred-point bucket and the other by band), so there is no
 * subtraction between them that a shared instant would protect.
 *
 * Every counter here is measured BACKWARDS FROM THE READ, which is what makes
 * the series irrecoverable: whether an account was observed, and whether it had
 * played, are both relative to the instant we asked, and we do not keep the
 * `last_seen_at` of a week ago to ask again with. So a day nobody recorded is a
 * day no later run can fill, exactly like `*_server_online`, and this has to be
 * running before the curve it draws can exist. It also rules out a backfill:
 * there is no earlier state to reconstruct one from.
 */

/** How much history the read path hands back at most. A year of a daily series
 * is 365 points per band, which is more than any chart on the site draws, and
 * bounding it here means the payload cannot grow without someone deciding to. */
const MAX_SERIES_DAYS = 365;

/** One row of the aggregate, before it is split into one record per window. The
 * counters are named by the window's INDEX rather than by its label, so the
 * reader walks `ACTIVITY_WINDOWS` and never parses a column name. */
type BandRow = {
  day: string;
  metric: RatingMetric;
  band: RatingColor;
  players: number;
} & Record<string, string | number>;

/** Column prefix for one window's four counters. */
const col = (index: number, name: string) => `w${index}_${name}`;

/**
 * The band a value falls in, as SQL, generated from the colour function itself.
 *
 * The thresholds are written once in `wn7Color`/`wn8Color`/`wnxColor` and
 * `ratingBands` walks them out, so this CASE cannot drift from the colours the
 * site draws everywhere else. A hand-written copy here would silently mislabel
 * every row of the series the day one of them moved, and the win-rate grid
 * beside it already made that argument.
 */
function bandCase(metric: RatingMetric, bands: RatingBand[]): SQL {
  const column = sql.identifier(metric);
  const whens = bands
    .filter((band) => band.to !== null)
    .map(
      (band) => sql`WHEN ${column} < ${band.to} THEN ${band.color}::text`,
    );
  const last = bands[bands.length - 1];
  return sql`CASE ${sql.join(whens, sql` `)} ELSE ${last.color}::text END`;
}

/**
 * Whether the account was seen, and whether it had played, per window.
 *
 * Decided inside the CTE rather than inside each metric's aggregate: the three
 * branches ask the same six questions of every row, so evaluating them in the
 * branches compares timestamps nine times per account instead of three. Measured
 * on EU, moving them here took a region from 15.0s to 8.0s for the same answer to
 * the row.
 */
function windowFlags(index: number, window: ActivityWindow): SQL {
  const span = sql`now() - make_interval(days => ${ACTIVITY_WINDOW_DAYS[window]})`;
  return sql`
    last_seen_at > ${span} AS ${sql.identifier(col(index, "seen"))},
    (last_seen_at > ${span} AND last_battle_at > ${span}) AS ${sql.identifier(col(index, "played"))}`;
}

/**
 * The four counters of one window.
 *
 * `observed` is the honest denominator and the whole reason this is four
 * numbers rather than a rate: an account is only known to be idle if we read it
 * recently enough to tell, so the rate is scored against the accounts we
 * actually looked at inside the window. `measured` separates "played, and we
 * know how much" from "played, and we hold no pair of snapshots to diff", which
 * would otherwise drag the intensity towards zero.
 */
function windowCounters(index: number, window: ActivityWindow): SQL {
  const battles = sql.identifier(`battles_${window}`);
  const seen = sql.identifier(col(index, "seen"));
  const played = sql.identifier(col(index, "played"));
  return sql`
    count(*) FILTER (WHERE ${seen})::int AS ${sql.identifier(col(index, "observed"))},
    count(*) FILTER (WHERE ${played})::int AS ${sql.identifier(col(index, "active"))},
    count(${battles}) FILTER (WHERE ${played})::int AS ${sql.identifier(col(index, "measured"))},
    COALESCE(sum(${battles}) FILTER (WHERE ${played}), 0)::bigint AS ${sql.identifier(col(index, "battles"))}`;
}

/**
 * Every band of every metric, over all three windows, in one pass.
 *
 * The population is the histograms' own (`battles >= DISTRIBUTION_MIN_BATTLES`
 * and all four figures present), so the two panels describe the same accounts
 * rather than two populations that happen to sit on one page. PR and WTR are
 * banded where present inside it, which is also how the histograms count them,
 * and the branch has to say so: a null falls through every WHEN of `bandCase`
 * to its ELSE, which is the top band. `MATERIALIZED` is
 * load-bearing exactly as it is there: without it the planner inlines the CTE
 * into each metric's branch and scans the player table three times.
 *
 * `now()` is evaluated once per statement, so the three windows and the day
 * stamped on the row all measure from the same instant.
 */
async function readBandActivity(region: Region): Promise<BandRow[]> {
  const players = playersByRegion[region];
  const counters = sql.join(
    ACTIVITY_WINDOWS.map((window, i) => windowCounters(i, window)),
    sql`,`,
  );
  const branches = RATING_METRICS.map(
    (metric) => sql`
      SELECT (now() AT TIME ZONE 'utc')::date::text AS day,
             ${metric}::text AS metric,
             ${bandCase(metric, ratingBands(metric))} AS band,
             count(*)::int AS players,
             ${counters}
      FROM sample WHERE ${sql.identifier(metric)} IS NOT NULL GROUP BY 3`,
  );
  const flags = sql.join(
    ACTIVITY_WINDOWS.map((window, i) => windowFlags(i, window)),
    sql`,`,
  );
  return db.execute<BandRow>(
    sql`WITH sample AS MATERIALIZED (
          SELECT wn7, wn8, wnx, pr, wtr,
                 battles_24h, battles_7d, battles_30d,
                 ${flags}
          FROM ${players}
          WHERE battles >= ${DISTRIBUTION_MIN_BATTLES}
            AND winrate IS NOT NULL
            AND wn7 IS NOT NULL
            AND wn8 IS NOT NULL
            AND wnx IS NOT NULL
        )
        ${sql.join(branches, sql` UNION ALL `)}`,
  );
}

/** Split one aggregate row into the three rows the table holds, one per window,
 * carrying the band's edges as they stood at this read. */
function toRecords(row: BandRow, edges: Map<RatingColor, RatingBand>): NewPlayerActivity[] {
  const band = edges.get(row.band);
  return ACTIVITY_WINDOWS.map((window, i) => ({
    day: row.day,
    metric: row.metric,
    band: row.band,
    window,
    bandFrom: band?.from ?? null,
    bandTo: band?.to ?? null,
    minBattles: DISTRIBUTION_MIN_BATTLES,
    players: row.players,
    observed: Number(row[col(i, "observed")] ?? 0),
    active: Number(row[col(i, "active")] ?? 0),
    measured: Number(row[col(i, "measured")] ?? 0),
    battles: Number(row[col(i, "battles")] ?? 0),
  }));
}

/**
 * Record one region's activity for the day in progress.
 *
 * An upsert rather than an insert, because the cron runs hourly and the day is
 * the key: every run of a day overwrites that day's rows with a longer view of
 * it, and the last run before midnight is the one that stands. That also makes a
 * re-run free, which is what lets a missed hour be caught up rather than leaving
 * a gap nothing can fill.
 */
export async function recordPlayerActivity(region: Region): Promise<number> {
  const rows = await readBandActivity(region);
  if (rows.length === 0) return 0;

  const edges = new Map<RatingMetric, Map<RatingColor, RatingBand>>(
    RATING_METRICS.map((metric) => [
      metric,
      new Map(ratingBands(metric).map((band) => [band.color, band])),
    ]),
  );
  const records = rows.flatMap((row) =>
    toRecords(row, edges.get(row.metric) ?? new Map()),
  );

  const target = playerActivityByRegion[region];
  await db
    .insert(target)
    .values(records)
    .onConflictDoUpdate({
      target: [target.metric, target.window, target.band, target.day],
      set: {
        bandFrom: sql`excluded.band_from`,
        bandTo: sql`excluded.band_to`,
        minBattles: sql`excluded.min_battles`,
        players: sql`excluded.players`,
        observed: sql`excluded.observed`,
        active: sql`excluded.active`,
        measured: sql`excluded.measured`,
        battles: sql`excluded.battles`,
        computedAt: sql`now()`,
      },
    });
  return records.length;
}

/**
 * One region's series for one window.
 *
 * Grouped into bands here rather than served as a flat list of points: the page
 * draws one line per band and reads the latest point of each beside it, so the
 * shape it wants is the band. A band the region has never filled is absent
 * rather than present and empty, for the reason the win-rate grid drops its own:
 * an empty row reads as a measurement of zero.
 */
export async function loadPlayerActivity(
  region: Region,
  window: ActivityWindow,
): Promise<PlayerActivity | null> {
  const table = playerActivityByRegion[region];
  const rows = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.window, window),
        // Subtracted as an interval rather than as a bare number of days: the
        // day count crosses the wire as an untyped parameter, so `date - $1`
        // leaves the planner with no operator to resolve and fails at parse.
        sql`${table.day} > (now() AT TIME ZONE 'utc' - make_interval(days => ${MAX_SERIES_DAYS}))::date`,
      ),
    )
    .orderBy(asc(table.day));
  if (rows.length === 0) return null;

  const metrics = Object.fromEntries(
    RATING_METRICS.map((metric) => [metric, [] as ActivityBand[]]),
  ) as Record<RatingMetric, ActivityBand[]>;

  for (const metric of RATING_METRICS) {
    const ofMetric = rows.filter((row) => row.metric === metric);
    const byBand = new Map<RatingColor, ActivityPoint[]>();
    const edges = new Map<RatingColor, RatingBand>();
    for (const row of ofMetric) {
      const points = byBand.get(row.band) ?? [];
      points.push({
        day: row.day,
        players: row.players,
        observed: row.observed,
        active: row.active,
        measured: row.measured,
        battles: row.battles,
      });
      byBand.set(row.band, points);
      // The edges of the band's most recent row, since rows are ascending and
      // the last write is the one today's axis should be labelled with.
      edges.set(row.band, {
        color: row.band,
        from: row.bandFrom,
        to: row.bandTo,
      });
    }
    // Ascending by band, from the colour function rather than from the rows, so
    // the order is the scale's own and not whatever the query returned.
    metrics[metric] = ratingBands(metric)
      .filter((band) => byBand.has(band.color))
      .map((band) => {
        const series = byBand.get(band.color) ?? [];
        const stored = edges.get(band.color) ?? band;
        return {
          band: band.color,
          from: stored.from,
          to: stored.to,
          latest: series[series.length - 1] ?? null,
          series,
        };
      });
  }

  const newest = rows[rows.length - 1];
  return {
    region,
    window,
    minBattles: newest.minBattles,
    metrics,
    computedAt: newest.computedAt,
  };
}
