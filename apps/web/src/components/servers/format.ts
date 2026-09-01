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

const players = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});
// A win rate always carries its decimal, even when it is a zero: the panels
// print them in columns, and "59%" beside "59.8%" reads as a rounder number
// rather than as the same precision.
const winrate = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatPlayers(value: number): string {
  return players.format(Math.round(value));
}

/** Abbreviated, for an axis gutter that cannot fit "123,456". */
export function formatPlayersCompact(value: number): string {
  return compact.format(value);
}

export function formatShare(value: number): string {
  return percent.format(value);
}

export function formatWinrate(value: number): string {
  return winrate.format(value);
}

// Memoized per zone: an `Intl.DateTimeFormat` is expensive to build and these
// run once per axis tick.
function formatter(
  options: Intl.DateTimeFormatOptions,
  zone: DisplayZone,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: zone === "local" ? undefined : "UTC",
  });
}

const cache = new Map<string, Intl.DateTimeFormat>();
function cached(
  key: string,
  options: Intl.DateTimeFormatOptions,
  zone: DisplayZone,
): Intl.DateTimeFormat {
  const id = `${key}:${zone}`;
  let found = cache.get(id);
  if (!found) {
    found = formatter(options, zone);
    cache.set(id, found);
  }
  return found;
}

const TIME_OF_DAY = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
const WEEKDAY_TIME = { weekday: "short", hour: "2-digit", hour12: false } as const;
const DAY_MONTH = { month: "short", day: "numeric" } as const;
const MONTH_ONLY = { month: "short" } as const;
const FULL_MOMENT = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
} as const;

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
): string {
  switch (range) {
    case ServerStatsRange.Day:
      return cached("timeOfDay", TIME_OF_DAY, zone).format(at);
    case ServerStatsRange.Week:
      return cached("weekdayTime", WEEKDAY_TIME, zone).format(at);
    case ServerStatsRange.Month:
      return cached("dayMonth", DAY_MONTH, zone).format(at);
    case ServerStatsRange.Year:
      return cached("monthOnly", MONTH_ONLY, zone).format(at);
  }
}

/** A point's full moment, for a tooltip or a record line. */
export function formatMoment(at: Date, zone: DisplayZone = "UTC"): string {
  return cached("fullMoment", FULL_MOMENT, zone).format(at);
}

/** Monday-first, matching the ISO weekday the rhythm is keyed by. */
export const WEEKDAY_LABEL = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
