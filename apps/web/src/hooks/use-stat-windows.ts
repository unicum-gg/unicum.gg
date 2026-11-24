"use client";

import { useCallback, useMemo } from "react";
import {
  DEFAULT_STAT_WINDOWS,
  formatStatWindow,
  parseStatWindow,
  type StatWindow,
} from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";

export type StatWindows = readonly [StatWindow, StatWindow, StatWindow];

const DEFAULT_VALUE = DEFAULT_STAT_WINDOWS.map(formatStatWindow).join(",");

/**
 * The three period columns of the profile's stats table, cookie-backed so the
 * reader's choice follows them across profiles and reloads, and broadcast so
 * the table and the phone's column picker read the same three.
 *
 * Each slot is read on its own and falls back to its default when the cookie
 * holds something it cannot parse, so one bad value never empties the table.
 */
export function useStatWindows(): [
  StatWindows,
  (slot: 0 | 1 | 2, next: StatWindow) => void,
] {
  const [stored, setStored] = useCookie(STORAGE.COOKIES.STAT_WINDOWS, DEFAULT_VALUE);
  const windows = useMemo<StatWindows>(() => {
    const parts = stored.split(",");
    return [0, 1, 2].map(
      (i) => parseStatWindow(parts[i] ?? "") ?? DEFAULT_STAT_WINDOWS[i],
    ) as unknown as StatWindows;
  }, [stored]);
  const setWindow = useCallback(
    (slot: 0 | 1 | 2, next: StatWindow) => {
      const updated = windows.map((w, i) => (i === slot ? next : w));
      setStored(updated.map(formatStatWindow).join(","));
    },
    [windows, setStored],
  );
  return [windows, setWindow];
}
