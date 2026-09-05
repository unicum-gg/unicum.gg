import { SessionGranularity } from "@unicum.gg/shared";

/**
 * How a session bucket is named, shared by the table and the chart above it.
 *
 * They had a copy each and the copies disagreed: the same monthly bucket read
 * "Aug 2026" on the axis and "August 2026" in the row underneath. The axis
 * wants the short form and the row the long one, so both live here and the
 * caller picks, rather than each keeping its own `Intl` instances.
 */
const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortDayFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const axisDayFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longMonthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortMonthFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** What one bucket is called, for prose about the granularity. */
export const GRANULARITY_NOUN: Record<SessionGranularity, string> = {
  [SessionGranularity.Daily]: "day",
  [SessionGranularity.Weekly]: "week",
  [SessionGranularity.Monthly]: "month",
};

const parse = (period: string) => new Date(`${period}T00:00:00Z`);

/** The full label, for a table row or a tooltip heading. */
export function sessionLabel(
  period: string,
  granularity: SessionGranularity,
): string {
  const d = parse(period);
  if (granularity === SessionGranularity.Monthly) return longMonthFmt.format(d);
  if (granularity === SessionGranularity.Weekly) {
    return `Week of ${shortDayFmt.format(d)}`;
  }
  return dayFmt.format(d);
}

/** The short label, for a chart axis where the ticks share their row. */
export function sessionAxisLabel(
  period: string,
  granularity: SessionGranularity,
): string {
  const d = parse(period);
  if (granularity === SessionGranularity.Monthly) return shortMonthFmt.format(d);
  return axisDayFmt.format(d);
}
