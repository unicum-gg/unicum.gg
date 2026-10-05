"use client";

import { dateFormat } from "@/lib/format";

import { useLocale } from "@onruntime/translations/react";
import { useCallback } from "react";
import { DATE_PATTERNS, DateShape } from "@/lib/date-shapes";
import { DEFAULT_LOCALE } from "@/lib/translations";

function formatterFor(locale: string, shape: DateShape) {
  return dateFormat(locale, DATE_PATTERNS[shape]);
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
