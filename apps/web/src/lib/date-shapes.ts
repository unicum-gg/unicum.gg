/**
 * The shapes a date is written in across the site, as patterns rather than as
 * `Intl` option sets.
 *
 * A pattern spells out an order and a separator, which is English's ("MMM d,
 * yyyy"), and every language wants its own. `Intl` carries all of them, so the
 * caller names the SHAPE it wants and the reader's language decides how that
 * shape is written. `dateStyle`/`timeStyle` have no `date-fns` equivalent (they
 * are whatever the platform decides a "medium" date looks like), so they are
 * spelled out here instead, which is what makes a date the same everywhere.
 *
 * Its own module, away from `components/local-date`, for the reason
 * `constants/pagination` is its own: a `"use client"` module exports client
 * REFERENCES, so a server component importing this enum from there is handed a
 * function rather than the string. Nothing breaks loudly, it just indexes the
 * pattern map with undefined and throws inside the formatter, and only on the
 * rows that actually carry a date. The marks board hit it the day it shipped,
 * on three of its four regions, because the fourth had no date to print yet.
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

export const DATE_PATTERNS: Record<DateShape, string> = {
  [DateShape.Month]: "MMMM yyyy",
  [DateShape.MonthShort]: "MMM yyyy",
  [DateShape.Day]: "d MMM yyyy",
  [DateShape.Weekday]: "EEEE d MMMM",
  [DateShape.DayTime]: "d MMM, HH:mm",
  [DateShape.DateTime]: "d MMM yyyy, HH:mm",
  [DateShape.DateTimeSeconds]: "d MMM yyyy, HH:mm:ss",
  [DateShape.Full]: "EEEE d MMMM yyyy, HH:mm",
};
