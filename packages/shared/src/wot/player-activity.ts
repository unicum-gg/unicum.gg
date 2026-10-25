import type { Region } from "@unicum.gg/wargaming";
import { RATING_METRICS, RatingMetric } from "../constants/rating";
import type { RatingColor } from "./ratings";

/**
 * Whether a band of the region's players is still playing, and how much.
 *
 * The client-safe shapes and the pure arithmetic over them. The queries and the
 * cron that fills the series live in core (`players/activity`), beside the
 * distribution scan they ride.
 *
 * The histograms on the same page count accounts per band, which says how many
 * players reached a level and nothing at all about whether they are still
 * logging in. These two counters are what separate the two questions: the share
 * of a band that turned up inside the window, and how many battles the ones who
 * did played. They move in opposite directions often enough to be worth drawing
 * side by side, since a band can be small and relentless or large and asleep.
 */

/**
 * How far back "active" looks.
 *
 * The three windows the player row already carries, so the series costs the
 * scan nothing extra. `TopPlayersPeriod` in core names the same three strings
 * and is deliberately not reused: it lives on the server side of the one-way
 * dependency, and it carries an `overall` member, which is a ranking over a
 * career and not a window anything can be active inside.
 */
export enum ActivityWindow {
  Day = "24h",
  Week = "7d",
  Month = "30d",
}

export const ACTIVITY_WINDOWS: ActivityWindow[] = [
  ActivityWindow.Day,
  ActivityWindow.Week,
  ActivityWindow.Month,
];

/** The window's span in days, which is both what the query subtracts and what
 * the page names it by. */
export const ACTIVITY_WINDOW_DAYS: Record<ActivityWindow, number> = {
  [ActivityWindow.Day]: 1,
  [ActivityWindow.Week]: 7,
  [ActivityWindow.Month]: 30,
};

/**
 * The window the page opens on.
 *
 * Thirty days rather than a day, because it is the only one of the three whose
 * denominator is nearly the whole band: an account is observed inside a window
 * only if we read it inside that window, and over 24 hours that is a small and
 * self-selected slice of the region (we refresh the accounts we believe are
 * active, which is the very thing being measured). Over thirty days it is 88 to
 * 96% of every band, so the rate is a measurement rather than a sample of our
 * own cadence.
 */
export const DEFAULT_ACTIVITY_WINDOW = ActivityWindow.Month;

export function isActivityWindow(value: string): value is ActivityWindow {
  return (ACTIVITY_WINDOWS as string[]).includes(value);
}

/** What was counted for one band on one day. The denominators travel with the
 * counts, so every rate below is derived rather than stored. */
export type ActivityCounts = {
  /** Accounts in the band, whatever we know about them. */
  players: number;
  /** Accounts we read inside the window, and the denominator of the rate. */
  observed: number;
  /** Observed accounts whose last battle falls inside the window. */
  active: number;
  /** Active accounts whose battle count for the window is known. */
  measured: number;
  /** Battles the measured accounts played inside the window. */
  battles: number;
};

/** One day of one band's series. */
export type ActivityPoint = ActivityCounts & {
  /** UTC day, `YYYY-MM-DD`. A string rather than a Date: it is a calendar day
   * and an axis label, and reviving it to a Date would hand every reader a
   * midnight in their own timezone to shift back off. */
  day: string;
};

/** One band, its latest reading and its history. */
export type ActivityBand = {
  band: RatingColor;
  /** The band's edges as the row was written with them, half-open and null at
   * the scale's two open ends. */
  from: number | null;
  to: number | null;
  /** The most recent day held, which is the day in progress and still
   * refining. Null for a band that has never been written. */
  latest: ActivityPoint | null;
  /** Ascending by day, oldest first. Empty until the cron has run once. */
  series: ActivityPoint[];
};

export type PlayerActivity = {
  region: Region;
  /** The window every count in the payload was measured over. */
  window: ActivityWindow;
  /**
   * Battles an account needs before it counts, inherited from the histograms
   * this rides so the two describe the same population.
   */
  minBattles: number;
  /** One series per metric, so the reader's chosen scale is served rather than
   * one being picked for them. Ascending by band. */
  metrics: Record<RatingMetric, ActivityBand[]>;
  computedAt: Date | null;
};

/**
 * The share of the band that played inside the window, 0..1.
 *
 * Against the accounts we observed, never against every account in the band:
 * an account nobody read inside the window is not known to be idle, and
 * counting it as such measures our refresh cadence rather than the players.
 * Null when nothing was observed, which is a band with no answer rather than a
 * band at zero.
 */
export function activityRate(counts: ActivityCounts): number | null {
  if (counts.observed <= 0) return null;
  return counts.active / counts.observed;
}

/**
 * Battles per active account inside the window.
 *
 * Over the accounts actually measured rather than over all the active ones, so
 * an account we know played but hold no diff for cannot drag the mean towards
 * zero. Null when none was measured.
 */
export function activityIntensity(counts: ActivityCounts): number | null {
  if (counts.measured <= 0) return null;
  return counts.battles / counts.measured;
}

/**
 * The share of the band whose activity is unknown, 0..1.
 *
 * What the rate above is blind to, and the one number that says how much to
 * trust it: these accounts were not read inside the window, so they are neither
 * active nor idle. It runs from about 4% of the top band to 12% of the bottom
 * one on EU, which is why it is published beside the rate rather than folded
 * into it.
 */
export function unobservedShare(counts: ActivityCounts): number | null {
  if (counts.players <= 0) return null;
  return (counts.players - counts.observed) / counts.players;
}

/** Sum a set of counts, so several bands can be read as one population without
 * averaging their rates. */
export function sumCounts(counts: ActivityCounts[]): ActivityCounts {
  return counts.reduce<ActivityCounts>(
    (acc, c) => ({
      players: acc.players + c.players,
      observed: acc.observed + c.observed,
      active: acc.active + c.active,
      measured: acc.measured + c.measured,
      battles: acc.battles + c.battles,
    }),
    { players: 0, observed: 0, active: 0, measured: 0, battles: 0 },
  );
}

/** The bands holding a reading, so a panel never draws an empty row for a band
 * nobody in the region falls into. */
export function bandsWithData(bands: ActivityBand[]): ActivityBand[] {
  return bands.filter((b) => b.latest !== null && b.latest.observed > 0);
}

/** An empty payload, so a caller can render its own waiting state without
 * special-casing null at every read. */
export function emptyActivity(
  region: Region,
  window: ActivityWindow,
  minBattles: number,
): PlayerActivity {
  return {
    region,
    window,
    minBattles,
    metrics: Object.fromEntries(
      RATING_METRICS.map((metric) => [metric, [] as ActivityBand[]]),
    ) as Record<RatingMetric, ActivityBand[]>,
    computedAt: null,
  };
}
