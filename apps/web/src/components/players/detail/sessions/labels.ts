import { dateFormat } from "@/lib/format";
import type { TranslateFunction } from "@onruntime/translations";
import { SessionGranularity } from "@unicum.gg/shared";

/**
 * How a session bucket is named, shared by the table and the chart above it.
 *
 * They had a copy each and the copies disagreed: the same monthly bucket read
 * "Aug 2026" on the axis and "August 2026" in the row underneath. The axis
 * wants the short form and the row the long one, so both live here and the
 * caller picks, rather than each keeping its own `Intl` instances.
 *
 * The reader's language is passed in rather than baked into the formatters,
 * because a date is written differently in each: "Mon, Sep 7, 2026" is
 * "lun. 7 sept. 2026" in French, and the month names are the language's own.
 * Written as `date-fns` patterns, which is how every date on this site is
 * formatted: the pattern is spelled once and the library carries the month
 * names, so two places cannot disagree the way two option objects can.
 */
type Shape = "day" | "shortDay" | "axisDay" | "longMonth" | "shortMonth";

// A session is stamped by the day it belongs to, which is a UTC day: the marker
// rides in the pattern, as `dateFormat` expects.
const PATTERNS: Record<Shape, string> = {
  day: "EEE d MMM yyyy /* UTC */",
  shortDay: "d MMM yyyy /* UTC */",
  axisDay: "d MMM /* UTC */",
  longMonth: "MMMM yyyy /* UTC */",
  shortMonth: "MMM yyyy /* UTC */",
};

function formatter(shape: Shape, locale: string) {
  return dateFormat(locale, PATTERNS[shape]);
}

/** The key naming one bucket, for prose about the granularity. */
export const GRANULARITY_NOUN: Record<SessionGranularity, string> = {
  [SessionGranularity.Daily]: "granularity.day",
  [SessionGranularity.Weekly]: "granularity.week",
  [SessionGranularity.Monthly]: "granularity.month",
};

const parse = (period: string) => new Date(`${period}T00:00:00Z`);

/** The full label, for a table row or a tooltip heading. */
export function sessionLabel(
  period: string,
  granularity: SessionGranularity,
  locale: string,
  t: TranslateFunction,
): string {
  const d = parse(period);
  if (granularity === SessionGranularity.Monthly) {
    return formatter("longMonth", locale).format(d);
  }
  if (granularity === SessionGranularity.Weekly) {
    return t("week-of", { date: formatter("shortDay", locale).format(d) });
  }
  return formatter("day", locale).format(d);
}

/** The short label, for a chart axis where the ticks share their row. */
export function sessionAxisLabel(
  period: string,
  granularity: SessionGranularity,
  locale: string,
): string {
  const d = parse(period);
  if (granularity === SessionGranularity.Monthly) {
    return formatter("shortMonth", locale).format(d);
  }
  return formatter("axisDay", locale).format(d);
}
