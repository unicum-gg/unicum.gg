"use client";

import { formatDistanceToNow } from "date-fns";
import { useSyncExternalStore } from "react";

function formatRelative(date: Date, now: number): string {
  const diffMs = now - date.getTime();
  const future = diffMs < 0;
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  if (absSeconds < 60) {
    if (absSeconds <= 1) return future ? "in a moment" : "just now";
    return future ? `in ${absSeconds} seconds` : `${absSeconds} seconds ago`;
  }
  return formatDistanceToNow(date, { addSuffix: true });
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

  return (
    <time className={className} dateTime={date.toISOString()} title={title}>
      {formatRelative(date, now)}
    </time>
  );
}
