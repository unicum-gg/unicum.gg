import { unstable_cache } from "next/cache";
import {
  loadServerAllTime,
  loadServerComparison,
  loadServerStats,
} from "@unicum.gg/core/wargaming/wot/server/history";
import type {
  RegionPopulationSeries,
  ServerComparison,
  ServerStats,
  ServerStatsRange,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * The servers endpoints' read path: the recorded population, cached.
 *
 * The underlying reads are indexed range scans over a table that grows by a few
 * thousand rows a day, so none of this is heavy the way the coverage aggregates
 * are. The cache is here because the answer cannot change between samples: the
 * sampler writes every five minutes and nothing else touches the table, so
 * recomputing per request would only re-derive the same numbers.
 */

// Well under the sampling interval, so a fresh sample reaches the page in about
// a minute rather than waiting out a cache keyed to the same cadence (which
// would double the worst-case staleness, sampling plus caching). The live
// header does not go through here at all: it reads Wargaming over SSE.
const REVALIDATE_SECONDS = 60;

/**
 * `unstable_cache` round-trips its value through JSON, so on a cache hit every
 * `Date` comes back as an ISO string while the type still claims `Date`. These
 * two revivers put them back, so callers keep the documented shape whether they
 * hit the cache or not.
 */
function reviveDate(value: Date | null): Date | null {
  return value ? new Date(value) : null;
}

function reviveStats(stats: ServerStats): ServerStats {
  return {
    ...stats,
    points: stats.points.map((p) => ({ ...p, at: new Date(p.at) })),
    clusters: stats.clusters.map((c) => ({
      ...c,
      peakAt: reviveDate(c.peakAt),
    })),
    peak: stats.peak ? { ...stats.peak, at: new Date(stats.peak.at) } : null,
    trough: stats.trough
      ? { ...stats.trough, at: new Date(stats.trough.at) }
      : null,
    allTimePeak: stats.allTimePeak
      ? { ...stats.allTimePeak, at: new Date(stats.allTimePeak.at) }
      : null,
    since: reviveDate(stats.since),
  };
}

function reviveSeries(series: RegionPopulationSeries): RegionPopulationSeries {
  return {
    ...series,
    peak: series.peak ? { ...series.peak, at: new Date(series.peak.at) } : null,
    points: series.points.map((p) => ({ ...p, at: new Date(p.at) })),
  };
}

const getServerStatsCached = unstable_cache(
  loadServerStats,
  ["server-stats"],
  { revalidate: REVALIDATE_SECONDS, tags: ["server-stats"] },
);

/**
 * The all-time record and the first sample, cached per region rather than per
 * range.
 *
 * They are the same two values whatever range is asked for, and finding them
 * means grouping the whole table by instant, the one read here that is not
 * windowed. Folded into the range-keyed entry, a reader clicking 24h then 7d
 * then 30d then 1y paid that full scan four times over for an identical answer.
 */
const getServerAllTimeCached = unstable_cache(
  loadServerAllTime,
  ["server-all-time"],
  { revalidate: REVALIDATE_SECONDS, tags: ["server-stats"] },
);

const getServerComparisonCached = unstable_cache(
  loadServerComparison,
  ["server-comparison"],
  { revalidate: REVALIDATE_SECONDS, tags: ["server-stats"] },
);

/** One region's recorded population over the range. */
export async function getServerStats(
  region: Region,
  range: ServerStatsRange,
): Promise<ServerStats> {
  const [stats, allTime] = await Promise.all([
    getServerStatsCached(region, range),
    getServerAllTimeCached(region),
  ]);
  return reviveStats({
    ...stats,
    allTimePeak: allTime.peak,
    since: allTime.since,
  });
}

/** The three regions' totals on one timeline. */
export async function getServerComparison(
  range: ServerStatsRange,
): Promise<ServerComparison> {
  const comparison = await getServerComparisonCached(range);
  return { ...comparison, regions: comparison.regions.map(reviveSeries) };
}
