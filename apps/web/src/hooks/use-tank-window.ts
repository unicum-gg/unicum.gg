"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  formatStatWindow,
  parseStatWindow,
  type StatWindow,
} from "@unicum.gg/shared";
import { sharedParamStore } from "@/lib/url-param-store";

/** The param the garage table's window is addressed by (`?window=30d`). */
export const TANK_WINDOW_PARAM = "window";

const store = sharedParamStore(TANK_WINDOW_PARAM);

/**
 * The window the garage table is read over, held in the URL, or null for the
 * vehicles' careers.
 *
 * In the URL and nowhere else, like the mode beside it: it changes what the
 * table SAYS, so a reader has to be able to send it, and a remembered choice
 * would open somebody else's garage on a window nobody asked for, under a
 * table that looks like the career one. The career is the absent param, and
 * anything that does not parse reads as the career rather than throwing.
 */
export function useTankWindow(): [StatWindow | null, (next: StatWindow | null) => void] {
  const raw = useSyncExternalStore(
    store.subscribe,
    () => store.read(),
    // A static page reads no params, so the first paint is the career and the
    // param applies on hydration.
    () => null,
  );
  const window = raw ? parseStatWindow(raw) : null;
  const setWindow = useCallback((next: StatWindow | null) => {
    store.write(next ? formatStatWindow(next) : null);
  }, []);
  // Parsed per render into a fresh object, so callers compare by value.
  return [window, setWindow];
}
