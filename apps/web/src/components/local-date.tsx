"use client";

import { dateFormat } from "@/lib/format";

import { useLocale } from "@onruntime/translations/react";
import { useCallback } from "react";
import { DEFAULT_LOCALE } from "@/lib/translations";

/**
 * The shapes a date is written in across the site, as `Intl` option sets rather
 * than the pattern strings a formatting library takes.
 *
 * A pattern spells out an order and a separator, which is English's ("MMM d,
 * yyyy"), and every language wants its own. `Intl` carries all of them, so the
 * caller names the SHAPE it wants and the reader's language decides how that
 * shape is written.
 */
export enum DateShape {
  /** "September 2015" */
  Month = "month",
  /** "Sep 2015" */
  MonthShort = "month-short",
  /** "Sep 7, 2015" */
  Day = "day",
  /** "Monday 7 September" */
  Weekday = "weekday",
  /** "Sep 7, 14:05" */
  DayTime = "day-time",
  /** "Sep 7, 2015, 14:05" */
  DateTime = "date-time",
  /** "Sep 7, 2015, 14:05:09" */
  DateTimeSeconds = "date-time-seconds",
  /** "Monday, September 7, 2015 at 14:05" */
  Full = "full",
}

// `dateStyle`/`timeStyle` have no `date-fns` equivalent: they are whatever the
// platform decides a "medium" date looks like. Spelled out as patterns instead,
// which is what makes them the same everywhere the site prints a date.
const PATTERNS: Record<DateShape, string> = {
  [DateShape.Month]: "MMMM yyyy",
  [DateShape.MonthShort]: "MMM yyyy",
  [DateShape.Day]: "d MMM yyyy",
  [DateShape.Weekday]: "EEEE d MMMM",
  [DateShape.DayTime]: "d MMM, HH:mm",
  [DateShape.DateTime]: "d MMM yyyy, HH:mm",
  [DateShape.DateTimeSeconds]: "d MMM yyyy, HH:mm:ss",
  [DateShape.Full]: "EEEE d MMMM yyyy, HH:mm",
};

function formatterFor(locale: string, shape: DateShape) {
  return dateFormat(locale, PATTERNS[shape]);
}

/**
 * A date formatter in the reader's language, for the places that need a string
 * rather than a node: a `title` attribute, an `aria-label`.
 */
export function useDateFormat(): (date: Date, shape: DateShape) => string {
  const { locale } = useLocale();
  const resolved = locale || DEFAULT_LOCALE;
  return useCallback(
    (date, shape) => formatterFor(resolved, shape).format(date),
    [resolved],
  );
}

/** A date written in the reader's language, as a `<time>` a crawler can read. */
export function LocalDate({
  date,
  shape,
  title,
  className,
}: {
  date: Date;
  shape: DateShape;
  title?: string;
  className?: string;
}) {

  const format = useDateFormat();
  return (
    <time className={className} dateTime={date.toISOString()} title={title}>
      {format(date, shape)}
    </time>
  );
}
