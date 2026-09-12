import { dateFormat, numberFormat } from "@/lib/format";
import { ServerStatsRange } from "@unicum.gg/shared";

/**
 * Which timezone a clock reading is rendered in.
 *
 * Named rather than left as `undefined`-means-local: a formatter that takes an
 * optional zone with a "UTC" default reads `undefined` as "use the default",
 * so the caller asking for local time silently got UTC. Both states are spelled
 * out here so neither can be the absence of the other.
 *
 * "local" is the runtime's own, which is the reader's in the browser and the
 * container's on the server. Those differ (production runs UTC), so every
 * component that renders a time both server-side and after hydration passes
 * `UTC` until it has hydrated, then its own. Without that, the prerendered HTML
 * carries "18:05" and the hydrated tree wants "20:05": a hydration mismatch on
 * every timestamp on the page. `useDisplayZone` supplies the value.
 */
export type DisplayZone = "UTC" | "local";

/** Formatting shared by the servers panels, so the chart axis, the tooltip and
 * the tables all print a population the same way. */

const PLAYERS_FORMAT = {} as const;
const COMPACT_FORMAT = {
  notation: "compact",
  maximumFractionDigits: 1,
} as const;
const PERCENT_FORMAT = {
  style: "percent",
  maximumFractionDigits: 1,
} as const;
// A win rate always carries its decimal, even when it is a zero: the panels
// print them in columns, and "59%" beside "59.8%" reads as a rounder number
// rather than as the same precision.
const WINRATE_FORMAT = {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const;

export function formatPlayers(value: number, locale: string): string {
  return numberFormat(locale, PLAYERS_FORMAT).format(Math.round(value));
}

/** Abbreviated, for an axis gutter that cannot fit "123,456". */
export function formatPlayersCompact(value: number, locale: string): string {
  return numberFormat(locale, COMPACT_FORMAT).format(value);
}

export function formatShare(value: number, locale: string): string {
  return numberFormat(locale, PERCENT_FORMAT).format(value);
}

export function formatWinrate(value: number, locale: string): string {
  return numberFormat(locale, WINRATE_FORMAT).format(value);
}

// Memoized per zone: an `Intl.DateTimeFormat` is expensive to build and these
// run once per axis tick.
// The reader's own language, and the display zone, decide the formatter. The
// zone rides in the pattern the way `dateFormat` expects, since this file's
// axes are read in UTC or locally depending on what the reader picked.
function cached(
  pattern: string,
  zone: DisplayZone,
  locale: string,
) {
  return dateFormat(locale, zone === "local" ? pattern : `${pattern} /* UTC */`);
}

const TIME_OF_DAY = "HH:mm";
const WEEKDAY_TIME = "EEE HH'h'";
const DAY_MONTH = "d MMM";
const MONTH_ONLY = "MMM";
const FULL_MOMENT = "d MMM, HH:mm";

/**
 * An axis tick for one instant, at the precision the range calls for: a day of
 * samples is read by the hour, a year by the month. Everything is formatted in
 * the reader's own timezone, which is the only one an evening peak means
 * anything in.
 */
export function formatTick(
  at: Date,
  range: ServerStatsRange,
  zone: DisplayZone,
  locale: string,
): string {
  switch (range) {
    case ServerStatsRange.Day:
      return cached(TIME_OF_DAY, zone, locale).format(at);
    case ServerStatsRange.Week:
      return cached(WEEKDAY_TIME, zone, locale).format(at);
    case ServerStatsRange.Month:
      return cached(DAY_MONTH, zone, locale).format(at);
    case ServerStatsRange.Year:
      return cached(MONTH_ONLY, zone, locale).format(at);
  }
}

/** A point's full moment, for a tooltip or a record line. */
export function formatMoment(
  at: Date,
  zone: DisplayZone,
  /** Required rather than defaulted: a default of "en" is the silent English
   * this whole pass exists to remove, and it would be invisible at every call
   * site that forgot it. */
  locale: string,
): string {
  return cached(FULL_MOMENT, zone, locale).format(at);
}

/**
 * Monday-first, matching the ISO weekday the rhythm is keyed by, in the
 * reader's language.
 *
 * Read from `Intl` rather than held as a table: every language already names
 * its own days and knows how it abbreviates them, and a table of seven English
 * three-letter forms is one more thing to translate badly. The anchors are an
 * arbitrary Monday-to-Sunday, used only to ask for a name.
 */
const WEEKDAY_ANCHORS = [1, 2, 3, 4, 5, 6, 7].map(
  (day) => new Date(Date.UTC(2024, 0, day)),
);

const weekdayCache = new Map<string, string[]>();

export function weekdayLabels(locale: string): string[] {
  const hit = weekdayCache.get(locale);
  if (hit) return hit;
  const fmt = dateFormat(locale, "EEE /* UTC */");
  const made = WEEKDAY_ANCHORS.map((day) => fmt.format(day));
  weekdayCache.set(locale, made);
  return made;
}
