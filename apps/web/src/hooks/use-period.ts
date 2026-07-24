"use client";

import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";

/**
 * The Overall / last-30-days axis shared by every leaderboard (the home "Top
 * players"/"Top clans" panels and the stronghold board). Its own enum — a
 * client module with no server deps — rather than the DB-heavy
 * `TopPlayersPeriod` / `TopClansPeriod`, which must not reach the browser
 * bundle. Values match those enums (and `StrongholdPeriod`), so the same cookie
 * string drives both the server fetch and the client toggle.
 */
export enum Period {
  Overall = "overall",
  Month = "30d",
}

export const PERIOD_LABEL: Record<Period, string> = {
  [Period.Overall]: "Overall",
  [Period.Month]: "Past 30 days",
};

export function isPeriod(v: string): v is Period {
  return v === Period.Overall || v === Period.Month;
}

/**
 * Cookie-backed period, shared across every panel/board that reads it. Writing
 * from one broadcasts to the others (via `useCookie`), so they stay in sync and
 * the choice survives reloads, the same way the rating metric does.
 */
export function usePeriod(): [Period, (next: Period) => void] {
  const [stored, setStored] = useCookie(STORAGE.COOKIES.PERIOD, Period.Overall);
  const period = isPeriod(stored) ? stored : Period.Overall;
  return [period, setStored];
}
