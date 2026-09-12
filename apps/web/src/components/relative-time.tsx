"use client";

import { useLocale } from "@onruntime/translations/react";
import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE } from "@/lib/translations";

/** Largest first, so the first unit the distance fills is the one it reads in. */
const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

// Building one costs more than formatting with it, and a leaderboard renders
// thirty on the same tick.
const formatters = new Map<string, Intl.RelativeTimeFormat>();

function formatterFor(locale: string): Intl.RelativeTimeFormat {
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    formatters.set(locale, formatter);
  }
  return formatter;
}

/**
 * `Intl.RelativeTimeFormat` rather than a formatting library, because the site
 * publishes in 27 languages and this is the one wording that cannot come from
 * the locale files: it depends on a number only known at render time. The
 * platform already carries every language's rules, so nothing is shipped for
 * them, and `numeric: "auto"` is what turns "in 0 seconds" into "now".
 */
function formatRelative(date: Date, now: number, locale: string): string {
  const seconds = Math.round((date.getTime() - now) / 1000);
  const distance = Math.abs(seconds);
  const [unit, size] =
    UNITS.find(([, size]) => distance >= size) ?? UNITS[UNITS.length - 1];
  return formatterFor(locale).format(Math.round(seconds / size), unit);
}

/**
 * One clock for the whole page, ticking only while something reads it.
 *
 * A store rather than per-component state, so a page showing thirty relative
 * times runs one interval instead of thirty, and so the first client value can
 * be read during render: the server has no clock to agree with, and reading the
 * real time from an effect is a second render on every one of them.
 */
let clock = Date.now();
const readers = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function subscribeToClock(onChange: () => void): () => void {
  readers.add(onChange);
  // The store may have been idle for hours: catch it up before the first read,
  // rather than showing the time of the last unsubscribe for a second.
  clock = Date.now();
  ticker ??= setInterval(() => {
    clock = Date.now();
    readers.forEach((notify) => notify());
  }, 1000);
  return () => {
    readers.delete(onChange);
    if (readers.size === 0 && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

const readClock = () => clock;

export function RelativeTime({
  date,
  title,
  className,
}: {
  date: Date;
  title?: string;
  className?: string;
}) {
  // The server renders it against its own timestamp, which reads "just now",
  // and hydration matches because it uses the same snapshot. The real clock
  // takes over on the first tick after mount.
  const now = useSyncExternalStore(subscribeToClock, readClock, () =>
    date.getTime(),
  );
  const { locale } = useLocale();

  return (
    <time className={className} dateTime={date.toISOString()} title={title}>
      {formatRelative(date, now, locale || DEFAULT_LOCALE)}
    </time>
  );
}
