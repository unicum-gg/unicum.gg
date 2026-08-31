import { type Region, REGION_LABEL } from "@unicum.gg/wargaming";

/**
 * Recorded population of the game's clusters: the client-safe shapes and the
 * pure arithmetic over them. The sampling and the reads live in core
 * (`wargaming/wot/server/*`), the instantaneous count in `./server-online`.
 */

/** How often the sampler records a cluster's population. Also the width of one
 * point on the day series, since that series is the raw samples. */
export const SERVER_SAMPLE_INTERVAL_MINUTES = 5;

/** How far back a population series reads. */
export enum ServerStatsRange {
  Day = "day",
  Week = "week",
  Month = "month",
  Year = "year",
}

export const SERVER_STATS_RANGES: readonly ServerStatsRange[] = [
  ServerStatsRange.Day,
  ServerStatsRange.Week,
  ServerStatsRange.Month,
  ServerStatsRange.Year,
];

export const SERVER_STATS_RANGE_LABEL: Record<ServerStatsRange, string> = {
  [ServerStatsRange.Day]: "24 hours",
  [ServerStatsRange.Week]: "7 days",
  [ServerStatsRange.Month]: "30 days",
  [ServerStatsRange.Year]: "1 year",
};

/** The window a range covers and the width of one of its points. A day is left
 * at the raw sampling interval so the evening peak keeps its shape, a year is
 * rolled to a day per point so the payload stays a few hundred numbers rather
 * than a hundred thousand. */
export const SERVER_STATS_RANGE_SPAN: Record<
  ServerStatsRange,
  { days: number; bucketMinutes: number }
> = {
  [ServerStatsRange.Day]: {
    days: 1,
    bucketMinutes: SERVER_SAMPLE_INTERVAL_MINUTES,
  },
  [ServerStatsRange.Week]: { days: 7, bucketMinutes: 60 },
  [ServerStatsRange.Month]: { days: 30, bucketMinutes: 60 },
  [ServerStatsRange.Year]: { days: 365, bucketMinutes: 24 * 60 },
};

export function isServerStatsRange(value: string): value is ServerStatsRange {
  return (SERVER_STATS_RANGES as readonly string[]).includes(value);
}


/**
 * The name to show for a cluster.
 *
 * Wargaming names a region's first clusters ("EU1", "EU2") and leaves the rest
 * as bare identifiers ("203", "205"), which mean nothing to a player. This
 * continues the region's own numbering over them, reading the number out of the
 * identifier itself: the hundreds digit is the region (2xx EU, 3xx NA, 5xx
 * ASIA) and what follows is the cluster, so 203 shows as EU3 and 501 as ASIA1.
 *
 * **Derived from the identifier, never from the population.** The labelling
 * this replaces sorted the clusters by players online and numbered them from
 * there, so "EU1" meant "the busiest one right now": on a night when EU2 was
 * ahead, EU2's figure was published under EU1, and EU4/EU5 swapped whenever
 * 204 and 205 traded places. Keyed on the identifier, a label belongs to one
 * server for good, which is the only version a recorded history can carry.
 *
 * Display only. The identifier stays the key everywhere anything is stored,
 * compared or plotted, and stays visible beside the label so nothing is hidden.
 */
export function serverDisplayName(region: Region, server: string): string {
  const numeric = /^\d+$/.test(server) ? Number(server) : null;
  if (numeric === null) return server;
  const index = numeric % 100;
  return index > 0 ? `${REGION_LABEL[region]}${index}` : server;
}

/** A population figure and the instant it was recorded. */
export type ServerRecord = { players: number; at: Date };

/**
 * One instant of the series. `values` is aligned with the payload's `servers`
 * array rather than keyed by cluster name: the two are always sent together, a
 * year of samples is a few thousand numbers, and repeating five cluster names
 * on every point would be most of the payload.
 */
export type ServerPopulationPoint = {
  at: Date;
  /** Sum of `values`, carried rather than recomputed so a chart can plot the
   * region line without summing on every render. */
  total: number;
  values: number[];
};

/** What one cluster did over the range. */
export type ServerClusterStat = {
  /** Wargaming's own cluster name ("EU1", "203"), never a rank. */
  server: string;
  /** Its population at the last recorded instant, null if it was absent from
   * that sample (a cluster taken down for maintenance stops being reported
   * rather than being reported at zero). */
  current: number | null;
  peak: number;
  peakAt: Date | null;
  average: number;
  /** Its share of the region's latest total, 0..1. Zero while the region has no
   * current total at all. */
  share: number;
};

/**
 * The average population of a weekday's hour, over the trailing weeks.
 *
 * `weekday` is ISO (1 Monday .. 7 Sunday) and `hour` is 0..23, **both in UTC**.
 * A rhythm is only worth reading in the reader's own time, so the shift happens
 * on the client (`localRhythm`), where the offset is known: the server has no
 * business guessing which timezone asked.
 */
export type ServerRhythmCell = {
  weekday: number;
  hour: number;
  average: number;
  /** How many instants fed the average. Zero for an hour the sampler has never
   * covered, which is every hour of the first week. */
  samples: number;
};

/** Everything the servers page shows for one region. */
export type ServerStats = {
  region: Region;
  range: ServerStatsRange;
  /** The clusters the region reported over the range, busiest first. Index into
   * this for a point's `values`. */
  servers: string[];
  points: ServerPopulationPoint[];
  clusters: ServerClusterStat[];
  /** Latest recorded region total, null before the first sample lands. */
  current: number | null;
  /** Mean region total across the range. */
  average: number;
  /** Highest and lowest region total inside the range. */
  peak: ServerRecord | null;
  trough: ServerRecord | null;
  /** Highest region total ever recorded, which for the first weeks is usually
   * also the range's peak. */
  allTimePeak: ServerRecord | null;
  rhythm: ServerRhythmCell[];
  /** The oldest sample on record. The page reads it to say how far the history
   * actually goes, since it starts the day sampling started and there is no
   * backfill for what came before. */
  since: Date | null;
};

/** One region's totals, for the cross-region comparison. */
export type RegionPopulationSeries = {
  region: Region;
  current: number | null;
  peak: ServerRecord | null;
  points: { at: Date; total: number }[];
};

export type ServerComparison = {
  range: ServerStatsRange;
  regions: RegionPopulationSeries[];
};

export const RHYTHM_WEEKDAYS = 7;
export const RHYTHM_HOURS = 24;

/** Index of a weekday/hour pair in a dense rhythm grid. */
function rhythmIndex(weekday: number, hour: number): number {
  return (weekday - 1) * RHYTHM_HOURS + hour;
}

/**
 * A dense 7x24 grid from however many cells the payload carries, so a consumer
 * can index straight into it. Hours the sampler has never covered come back
 * with `samples: 0`, which the heatmap draws as empty rather than as quiet.
 */
export function rhythmGrid(cells: ServerRhythmCell[]): ServerRhythmCell[] {
  const grid: ServerRhythmCell[] = [];
  for (let weekday = 1; weekday <= RHYTHM_WEEKDAYS; weekday++) {
    for (let hour = 0; hour < RHYTHM_HOURS; hour++) {
      grid.push({ weekday, hour, average: 0, samples: 0 });
    }
  }
  for (const cell of cells) {
    const i = rhythmIndex(cell.weekday, cell.hour);
    if (i >= 0 && i < grid.length) grid[i] = cell;
  }
  return grid;
}

/**
 * The same grid read in a timezone `offsetHours` ahead of UTC, i.e. what a
 * reader in Paris (+2) or Sydney (+10) actually experiences: an hour recorded
 * at 18:00 UTC on a Monday is 20:00 Monday for one and 04:00 Tuesday for the
 * other, and a heatmap that ignored that would tell every reader the game peaks
 * at a time nobody plays.
 *
 * The offset is rounded to the hour, so the half-hour zones (India, parts of
 * Australia) read their nearest hour rather than an interpolation between two
 * averages that would blur the peak for everyone else's benefit.
 */
export function localRhythm(
  cells: ServerRhythmCell[],
  offsetHours: number,
): ServerRhythmCell[] {
  const shift = Math.round(offsetHours);
  const source = rhythmGrid(cells);
  return source.map((cell) => {
    const absolute = (cell.weekday - 1) * RHYTHM_HOURS + cell.hour + shift;
    const wrapped =
      ((absolute % (RHYTHM_WEEKDAYS * RHYTHM_HOURS)) +
        RHYTHM_WEEKDAYS * RHYTHM_HOURS) %
      (RHYTHM_WEEKDAYS * RHYTHM_HOURS);
    return {
      ...cell,
      weekday: Math.floor(wrapped / RHYTHM_HOURS) + 1,
      hour: wrapped % RHYTHM_HOURS,
    };
  });
}

/** The busiest cell of a rhythm, ignoring the hours never sampled. Null while
 * nothing has been recorded yet. */
export function busiestRhythmCell(
  cells: ServerRhythmCell[],
): ServerRhythmCell | null {
  let best: ServerRhythmCell | null = null;
  for (const cell of cells) {
    if (cell.samples === 0) continue;
    if (!best || cell.average > best.average) best = cell;
  }
  return best;
}

/** The quietest sampled cell, the counterpart of `busiestRhythmCell`. */
export function quietestRhythmCell(
  cells: ServerRhythmCell[],
): ServerRhythmCell | null {
  let worst: ServerRhythmCell | null = null;
  for (const cell of cells) {
    if (cell.samples === 0) continue;
    if (!worst || cell.average < worst.average) worst = cell;
  }
  return worst;
}

/**
 * How the live count compares with what this weekday and hour usually holds,
 * as a ratio around 1 (1.2 = a fifth busier than usual). Null when the hour has
 * never been sampled or holds no players, so the caller shows nothing rather
 * than a division by zero dressed up as a statistic.
 */
export function rhythmDeviation(
  cells: ServerRhythmCell[],
  at: Date,
  total: number,
): number | null {
  const weekday = at.getUTCDay() === 0 ? 7 : at.getUTCDay();
  const cell = rhythmGrid(cells)[rhythmIndex(weekday, at.getUTCHours())];
  if (!cell || cell.samples === 0 || cell.average <= 0) return null;
  return total / cell.average;
}
