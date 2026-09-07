"use client";

import { StrongholdPeriod } from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";

/**
 * The Overall / last-30-days axis shared by every leaderboard (the home "Top
 * players"/"Top clans" panels and the stronghold board). Its own enum, a
 * client module with no server deps, rather than the DB-heavy
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
 *
 * `Period` is the COMMON DENOMINATOR of the boards that share the cookie, not
 * the full set any one of them supports: the home clans panel only has overall
 * and 30d (`TopClansPeriod`). A consumer that understands more windows reads the
 * same cookie through its own validator and clamps what it cannot render, which
 * is what the `isPeriod` guard here does for the values it does not know.
 */
export function usePeriod(): [Period, (next: Period) => void] {
  const [stored, setStored] = useCookie(STORAGE.COOKIES.PERIOD, Period.Overall);
  const period = isPeriod(stored) ? stored : Period.Overall;
  return [period, setStored];
}

export function isStrongholdPeriod(v: string): v is StrongholdPeriod {
  return (Object.values(StrongholdPeriod) as string[]).includes(v);
}

/**
 * The same cookie, read as a `StrongholdPeriod`. The stronghold boards rank on
 * four windows where the home panels only offer two, so they cannot go through
 * `usePeriod`, it would clamp 24h and 7d back to Overall, silently. That is
 * exactly what happened when the two short windows were added: `?period=24h`
 * was dropped by `isPeriod` and the board rendered all-time totals under a 24h
 * label, and the `as unknown as StrongholdPeriod` cast at the call site kept tsc
 * from noticing the enums had stopped matching.
 *
 * Writing a stronghold-only value into the shared cookie is safe: the home
 * panels clamp anything they do not recognise back to Overall.
 */
export function useStrongholdPeriod(): [
  StrongholdPeriod,
  (next: StrongholdPeriod) => void,
] {
  const [stored, setStored] = useCookie(
    STORAGE.COOKIES.PERIOD,
    StrongholdPeriod.Overall,
  );
  return [
    isStrongholdPeriod(stored) ? stored : StrongholdPeriod.Overall,
    setStored,
  ];
}

/**
 * The same four windows, read by a stats table rather than by a board.
 *
 * The enum is called `StrongholdPeriod` because the stronghold leaderboards
 * were the first thing that needed all four, but the axis belongs to the site:
 * a profile asking "how did the last 7 days go" is asking the boards' question
 * about one account. Sharing the cookie is the point rather than an accident,
 * the reader names a window once and every surface that can honour it does.
 */
export const useStatsPeriod = useStrongholdPeriod;

/**
 * The four windows in the order a stats table lays its COLUMNS out: the career
 * first, then the three that read back from now.
 *
 * Positional, and read as such: the clan stronghold table maps it straight onto
 * a fixed `<colgroup>` under the literal Total/24h/7d/30d headings. So it is not
 * a menu order and must not be reused as one, or reordering a dropdown would
 * quietly file the 24h figures under "Total". A select that happens to want the
 * same order says so itself.
 */
export const STATS_PERIODS = [
  StrongholdPeriod.Overall,
  StrongholdPeriod.Day,
  StrongholdPeriod.Week,
  StrongholdPeriod.Month,
] as const;
