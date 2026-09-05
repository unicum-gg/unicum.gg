import { sql } from "drizzle-orm";
import {
  type RegionPopulationSeries,
  SERVER_STATS_RANGE_SPAN,
  type ServerClusterStat,
  type ServerComparison,
  type ServerPopulationPoint,
  type ServerRecord,
  type ServerRhythmCell,
  type ServerStats,
  ServerStatsRange,
  serverOnlineByRegion,
} from "@unicum.gg/shared";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/**
 * Read the recorded population of a region's clusters.
 *
 * Every query here groups by instant first (`SUM(players_online)` over one
 * `sampled_at`) and only then aggregates over time, because a region total is a
 * sum across clusters at one moment and an average of those sums over a window.
 * Averaging the clusters' own averages instead would answer a different, wrong
 * question the moment a cluster appears or disappears mid-window, which is
 * exactly what happens when Wargaming takes one down for maintenance.
 *
 * Timestamps cross the wire as epoch seconds rather than as formatted
 * timestamps: postgres would render them in the session's timezone, and the one
 * thing a rhythm must not do is silently depend on where the process runs. The
 * weekday and hour buckets are pinned to UTC for the same reason, and are
 * shifted into the reader's own timezone on the client, where the offset is
 * actually known.
 */

/** How far back the weekly rhythm looks. Four weeks is enough for each weekday
 * to have been seen four times (so one bank holiday or one patch day cannot
 * define a Tuesday), and recent enough that a season's shift in habits shows up
 * rather than being buried under a year of averages. */
const RHYTHM_DAYS = 28;

/**
 * How old the newest sample may be and still count as the current population.
 *
 * Six missed ticks. Without a bound, `max(sampled_at)` answers whatever the
 * last row is, so a region whose sampling stopped weeks ago (the worker down,
 * or Wargaming's endpoint 504ing, which is a documented state for Asia) would
 * publish a three-week-old figure as its live count, under a pulsing dot,
 * beside cluster peaks and averages that ARE windowed and so read zero.
 */
const LATEST_MAX_AGE_MINUTES = 30;

type PeakRow = {
  peak: number | null;
  peak_epoch: number | null;
  trough: number | null;
  trough_epoch: number | null;
  average: number | null;
};

function toDate(epochSeconds: number | null | undefined): Date | null {
  return epochSeconds == null ? null : new Date(epochSeconds * 1000);
}

function toRecord(
  players: number | null | undefined,
  epochSeconds: number | null | undefined,
): ServerRecord | null {
  const at = toDate(epochSeconds);
  if (players == null || !at) return null;
  return { players, at };
}

/** The clusters' populations bucketed over the range, one row per bucket per
 * cluster. The day range's bucket is the sampling interval itself, so its
 * average is over a single row and the raw curve survives. */
async function readSeries(
  region: Region,
  range: ServerStatsRange,
): Promise<{ bucket_epoch: number; server: string; players: number }[]> {
  const t = serverOnlineByRegion[region];
  const { days, bucketMinutes } = SERVER_STATS_RANGE_SPAN[range];
  const bucketSeconds = bucketMinutes * 60;
  return db.execute<{ bucket_epoch: number; server: string; players: number }>(
    sql`SELECT
          (floor(extract(epoch FROM sampled_at) / ${bucketSeconds}) * ${bucketSeconds})::double precision AS bucket_epoch,
          server,
          round(avg(players_online))::int AS players
        FROM ${t}
        WHERE sampled_at >= now() - (${days} || ' days')::interval
        GROUP BY 1, 2
        ORDER BY 1`,
  );
}

/** The region's high, low and mean total inside the range. */
async function readRangeTotals(
  region: Region,
  range: ServerStatsRange,
): Promise<PeakRow> {
  const t = serverOnlineByRegion[region];
  const { days } = SERVER_STATS_RANGE_SPAN[range];
  const rows = await db.execute<PeakRow>(
    sql`WITH totals AS (
          SELECT sampled_at, SUM(players_online)::int AS total
          FROM ${t}
          WHERE sampled_at >= now() - (${days} || ' days')::interval
          GROUP BY sampled_at
        )
        SELECT
          (SELECT round(avg(total))::int FROM totals) AS average,
          (SELECT total FROM totals ORDER BY total DESC, sampled_at DESC LIMIT 1) AS peak,
          (SELECT extract(epoch FROM sampled_at)::double precision FROM totals ORDER BY total DESC, sampled_at DESC LIMIT 1) AS peak_epoch,
          (SELECT total FROM totals ORDER BY total ASC, sampled_at DESC LIMIT 1) AS trough,
          (SELECT extract(epoch FROM sampled_at)::double precision FROM totals ORDER BY total ASC, sampled_at DESC LIMIT 1) AS trough_epoch`,
  );
  return (
    rows[0] ?? {
      peak: null,
      peak_epoch: null,
      trough: null,
      trough_epoch: null,
      average: null,
    }
  );
}

/**
 * The highest total ever recorded, and the oldest sample on record.
 *
 * Unwindowed on purpose: a record is only a record against everything. It scans
 * the whole table, which is a few hundred thousand rows a year and cheap for
 * now, and sits behind the endpoint's cache. If the table ever outgrows that,
 * the answer is a running record row rather than a shorter window, since a
 * window would quietly turn "all-time peak" into "peak since we stopped
 * looking".
 *
 * Exported and read separately from `loadServerStats`, because it is the same
 * answer for every range and the caller caches it per region rather than paying
 * this scan once per range.
 */
export async function loadServerAllTime(
  region: Region,
): Promise<{ peak: ServerRecord | null; since: Date | null }> {
  const t = serverOnlineByRegion[region];
  const rows = await db.execute<{
    peak: number | null;
    peak_epoch: number | null;
    since_epoch: number | null;
  }>(
    sql`WITH totals AS (
          SELECT sampled_at, SUM(players_online)::int AS total
          FROM ${t}
          GROUP BY sampled_at
        )
        SELECT
          (SELECT total FROM totals ORDER BY total DESC, sampled_at DESC LIMIT 1) AS peak,
          (SELECT extract(epoch FROM sampled_at)::double precision FROM totals ORDER BY total DESC, sampled_at DESC LIMIT 1) AS peak_epoch,
          (SELECT extract(epoch FROM min(sampled_at))::double precision FROM ${t}) AS since_epoch`,
  );
  const row = rows[0];
  return {
    peak: toRecord(row?.peak, row?.peak_epoch),
    since: toDate(row?.since_epoch),
  };
}

/** Average region total per UTC weekday and hour, over the trailing weeks. */
async function readRhythm(region: Region): Promise<ServerRhythmCell[]> {
  const t = serverOnlineByRegion[region];
  const rows = await db.execute<{
    weekday: number;
    hour: number;
    average: number;
    samples: number;
  }>(
    sql`WITH totals AS (
          SELECT sampled_at, SUM(players_online)::int AS total
          FROM ${t}
          WHERE sampled_at >= now() - (${RHYTHM_DAYS} || ' days')::interval
          GROUP BY sampled_at
        )
        SELECT
          extract(isodow FROM sampled_at AT TIME ZONE 'UTC')::int AS weekday,
          extract(hour FROM sampled_at AT TIME ZONE 'UTC')::int AS hour,
          round(avg(total))::int AS average,
          count(*)::int AS samples
        FROM totals
        GROUP BY 1, 2`,
  );
  return rows.map((r) => ({
    weekday: r.weekday,
    hour: r.hour,
    average: r.average,
    samples: r.samples,
  }));
}

/** Each cluster's population at the last instant recorded, provided that
 * instant is recent enough to still describe now. A cluster missing from it is
 * missing from the result: Wargaming stops listing a
 * cluster it has taken down rather than reporting it at zero, and the two are
 * not the same thing. */
async function readLatest(region: Region): Promise<Map<string, number>> {
  const t = serverOnlineByRegion[region];
  const rows = await db.execute<{ server: string; players_online: number }>(
    sql`SELECT server, players_online
        FROM ${t}
        WHERE sampled_at = (
          SELECT max(sampled_at) FROM ${t}
          WHERE sampled_at >= now() - (${LATEST_MAX_AGE_MINUTES} || ' minutes')::interval
        )`,
  );
  return new Map(rows.map((r) => [r.server, r.players_online]));
}

/** Each cluster's own high and mean inside the range. */
async function readClusterTotals(
  region: Region,
  range: ServerStatsRange,
): Promise<Map<string, { peak: number; peakAt: Date | null; average: number }>> {
  const t = serverOnlineByRegion[region];
  const { days } = SERVER_STATS_RANGE_SPAN[range];
  const rows = await db.execute<{
    server: string;
    peak: number;
    peak_epoch: number | null;
    average: number;
  }>(
    sql`WITH windowed AS (
          SELECT server, sampled_at, players_online
          FROM ${t}
          WHERE sampled_at >= now() - (${days} || ' days')::interval
        ),
        peaks AS (
          SELECT DISTINCT ON (server)
            server,
            players_online AS peak,
            extract(epoch FROM sampled_at)::double precision AS peak_epoch
          FROM windowed
          ORDER BY server, players_online DESC, sampled_at DESC
        ),
        means AS (
          SELECT server, round(avg(players_online))::int AS average
          FROM windowed
          GROUP BY server
        )
        SELECT p.server, p.peak, p.peak_epoch, m.average
        FROM peaks p
        JOIN means m USING (server)`,
  );
  return new Map(
    rows.map((r) => [
      r.server,
      { peak: r.peak, peakAt: toDate(r.peak_epoch), average: r.average },
    ]),
  );
}

/**
 * Fold the per-cluster rows into the points the chart plots.
 *
 * `servers` fixes the column order once and every point carries its values in
 * that order, so a cluster that was down for part of the window still holds its
 * slot (as a zero) instead of shifting every later cluster's series across.
 */
function buildPoints(
  rows: { bucket_epoch: number; server: string; players: number }[],
  servers: string[],
): ServerPopulationPoint[] {
  const index = new Map(servers.map((s, i) => [s, i]));
  const byBucket = new Map<number, number[]>();
  for (const row of rows) {
    let values = byBucket.get(row.bucket_epoch);
    if (!values) {
      values = new Array<number>(servers.length).fill(0);
      byBucket.set(row.bucket_epoch, values);
    }
    const i = index.get(row.server);
    if (i !== undefined) values[i] = row.players;
  }
  return [...byBucket.entries()]
    .sort(([a], [b]) => a - b)
    .map(([epoch, values]) => ({
      at: new Date(epoch * 1000),
      total: values.reduce((sum, n) => sum + n, 0),
      values,
    }));
}

/**
 * Everything the servers page shows for one region.
 *
 * Every read is a range scan on `sampled_at` over a table of a few hundred
 * thousand rows, so they run concurrently rather than in sequence: nothing here
 * is heavy enough to need serializing off the request path the way the coverage
 * aggregates do.
 */
export async function loadServerStats(
  region: Region,
  range: ServerStatsRange,
): Promise<ServerStats> {
  const [seriesRows, totals, allTime, rhythm, latest, clusterTotals] =
    await Promise.all([
      readSeries(region, range),
      readRangeTotals(region, range),
      loadServerAllTime(region),
      readRhythm(region),
      readLatest(region),
      readClusterTotals(region, range),
    ]);

  // Busiest first, and a cluster absent from the latest sample is ordered by
  // what it averaged rather than dropped: it is down, not gone.
  const names = [...new Set([...clusterTotals.keys(), ...latest.keys()])];
  const weight = (server: string) =>
    latest.get(server) ?? clusterTotals.get(server)?.average ?? 0;
  const servers = names.sort((a, b) => weight(b) - weight(a));

  const current = latest.size
    ? [...latest.values()].reduce((sum, n) => sum + n, 0)
    : null;

  const clusters: ServerClusterStat[] = servers.map((server) => {
    const cluster = clusterTotals.get(server);
    const now = latest.get(server) ?? null;
    return {
      server,
      current: now,
      peak: cluster?.peak ?? 0,
      peakAt: cluster?.peakAt ?? null,
      average: cluster?.average ?? 0,
      share: current && current > 0 && now != null ? now / current : 0,
    };
  });

  return {
    region,
    range,
    servers,
    points: buildPoints(seriesRows, servers),
    clusters,
    current,
    average: totals.average ?? 0,
    peak: toRecord(totals.peak, totals.peak_epoch),
    trough: toRecord(totals.trough, totals.trough_epoch),
    allTimePeak: allTime.peak,
    rhythm,
    since: allTime.since,
  };
}

/** One region's totals over the range, for the cross-region comparison. */
async function loadRegionSeries(
  region: Region,
  range: ServerStatsRange,
): Promise<RegionPopulationSeries> {
  const [seriesRows, totals, latest] = await Promise.all([
    readSeries(region, range),
    readRangeTotals(region, range),
    readLatest(region),
  ]);
  const servers = [...new Set(seriesRows.map((r) => r.server))];
  return {
    region,
    current: latest.size
      ? [...latest.values()].reduce((sum, n) => sum + n, 0)
      : null,
    peak: toRecord(totals.peak, totals.peak_epoch),
    points: buildPoints(seriesRows, servers).map(({ at, total }) => ({
      at,
      total,
    })),
  };
}

/**
 * The three regions' totals on one timeline.
 *
 * Its own read rather than three calls to `loadServerStats`, because a
 * comparison needs one number per region per instant and that payload asks for
 * everything: the per-cluster breakdown, the rhythm grid and the all-time scan,
 * three times over, to draw three lines.
 */
export async function loadServerComparison(
  range: ServerStatsRange,
): Promise<ServerComparison> {
  const regions = await Promise.all(
    REGIONS.map((region) => loadRegionSeries(region, range)),
  );
  return { range, regions };
}
