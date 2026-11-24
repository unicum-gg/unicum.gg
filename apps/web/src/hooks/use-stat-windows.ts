"use client";

import { useCallback, useMemo } from "react";
import {
  DEFAULT_STAT_WINDOWS,
  StatWindowUnit,
  formatStatWindow,
  parseStatWindow,
  type StatWindow,
} from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";

export type StatWindows = readonly [StatWindow, StatWindow, StatWindow];

/**
 * Whose period columns: a player's (days or battles, the Random table and
 * every mode tab alike) or a clan's (days only: a clan plays several tiers at
 * once, so "its last N battles" names no single stretch of time).
 *
 * Both read ONE cookie, so a window the reader names is the same on every
 * page: a column set to 90 days on a profile is 90 days on a clan too. A
 * column set in battles has no clan reading, so the clan tables show that
 * slot's default instead, and setting it from a clan writes days back for
 * the profile as well.
 */
export enum StatWindowScope {
  Player = "player",
  Clan = "clan",
}

const UNITS: Record<StatWindowScope, StatWindowUnit[]> = {
  [StatWindowScope.Player]: [StatWindowUnit.Battles, StatWindowUnit.Days],
  [StatWindowScope.Clan]: [StatWindowUnit.Days],
};

/** The units a scope's columns may be set in. */
export function statWindowUnits(scope: StatWindowScope): StatWindowUnit[] {
  return UNITS[scope];
}

const DEFAULT_VALUE = DEFAULT_STAT_WINDOWS.map(formatStatWindow).join(",");

/**
 * The three period columns of the stats tables, cookie-backed so the
 * reader's choice follows them across pages and reloads, and broadcast so the
 * tables and the phone's column picker read the same three.
 *
 * Each slot is read on its own and falls back to its default when the cookie
 * holds something it cannot parse or a unit the scope does not take, so one
 * bad value never empties the table.
 */
export function useStatWindows(scope: StatWindowScope = StatWindowScope.Player): [
  StatWindows,
  (slot: 0 | 1 | 2, next: StatWindow) => void,
] {
  const units = UNITS[scope];
  const [stored, setStored] = useCookie(STORAGE.COOKIES.STAT_WINDOWS, DEFAULT_VALUE);
  const windows = useMemo<StatWindows>(() => {
    const parts = stored.split(",");
    return [0, 1, 2].map((i) => {
      const w = parseStatWindow(parts[i] ?? "");
      return w && units.includes(w.unit) ? w : DEFAULT_STAT_WINDOWS[i];
    }) as unknown as StatWindows;
  }, [stored, units]);
  // Written from the cookie as stored rather than from `windows`: a clan
  // table sees a battle window as its default, and saving another column
  // from there must not erase the profile's battle window with it.
  const setWindow = useCallback(
    (slot: 0 | 1 | 2, next: StatWindow) => {
      const parts = stored.split(",");
      const updated = [0, 1, 2].map((i) =>
        i === slot
          ? next
          : (parseStatWindow(parts[i] ?? "") ?? DEFAULT_STAT_WINDOWS[i]),
      );
      setStored(updated.map(formatStatWindow).join(","));
    },
    [stored, setStored],
  );
  return [windows, setWindow];
}
