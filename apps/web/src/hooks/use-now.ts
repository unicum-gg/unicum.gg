"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, read through a store rather than during render.
 *
 * Calling `Date.now()` while rendering is impure (React's own lint rejects it)
 * and, on a `force-static` page, wrong: the server's clock would be baked into
 * HTML served hours later, so "Today" could name yesterday. The store contract
 * fixes both, and it is the same shape `RelativeTime` uses for its own clock.
 *
 * Seeded at module load, which happens outside render, and ticked once a minute
 * while anything is listening. A minute is the resolution this is for: which day
 * a tournament falls on, and whether its start has passed.
 */
let clock = typeof window === "undefined" ? 0 : Date.now();
const readers = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void): () => void {
  readers.add(onChange);
  // The module may have been loaded long before this mounted: catch up before
  // the first read rather than reporting a stale minute.
  clock = Date.now();
  ticker ??= setInterval(() => {
    clock = Date.now();
    readers.forEach((notify) => notify());
  }, 60_000);
  return () => {
    readers.delete(onChange);
    if (readers.size === 0 && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

const read = () => clock;
/** Zero on the server, which callers read as "no clock yet" and render nothing
 * time-dependent until hydration. */
const readServer = () => 0;

export function useNow(): number {
  return useSyncExternalStore(subscribe, read, readServer);
}
