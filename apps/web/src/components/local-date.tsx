"use client";

import { dateFormat } from "@/lib/format";

import { useLocale } from "@onruntime/translations/react";
import { useCallback } from "react";
import { DATE_PATTERNS, DateShape } from "@/lib/date-shapes";
import { DEFAULT_LOCALE } from "@/lib/translations";
import { Hint } from "@/components/hint";

function formatterFor(locale: string, shape: DateShape) {
  return dateFormat(locale, DATE_PATTERNS[shape]);
}

/**
 * A date formatter in the reader's language, for the places that need a string
 * rather than a node: a hint's content, an `aria-label`.
 */
export function useDateFormat(): (date: Date, shape: DateShape) => string {
  const { locale } = useLocale();
  const resolved = locale || DEFAULT_LOCALE;
  return useCallback(
    (date, shape) => formatterFor(resolved, shape).format(date),
    [resolved],
  );
}

/**
 * A date written in the reader's language, as a `<time>` a crawler can read.
 *
 * `title` is the exact instant behind a shortened one, drawn as a hint rather
 * than handed to the browser: a caller passing it is explaining the date it
 * shortened, which is the site speaking and should look like it.
 */
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
    <Hint content={title}>
      <time className={className} dateTime={date.toISOString()}>
        {format(date, shape)}
      </time>
    </Hint>
  );
}
