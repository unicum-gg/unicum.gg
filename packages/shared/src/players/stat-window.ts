import type { PeriodDerivedValues } from "./derived-stats";
import type { PlayerPeriodStats } from "./stats";

/**
 * What a period column of the profile's stats table reads back over: a number
 * of days from now, or the player's last N battles.
 */
export enum StatWindowUnit {
  Days = "days",
  Battles = "battles",
}

export type StatWindow = { unit: StatWindowUnit; value: number };

/**
 * The longest window each unit accepts. A year of days is already further back
 * than most accounts have been tracked, and the column says so when it is (see
 * `PlayerStatWindow.truncated`). Ten thousand battles is several years of
 * play for anybody but the heaviest accounts, and costs the same query.
 */
export const STAT_WINDOW_MAX: Record<StatWindowUnit, number> = {
  [StatWindowUnit.Days]: 365,
  [StatWindowUnit.Battles]: 10_000,
};

/**
 * The three period columns as they ship, which is also what the profile
 * payload computes: 24 hours, 7 days and 30 days. A column set to anything
 * else is read from its own endpoint, so the payload never grows with them.
 */
export const DEFAULT_STAT_WINDOWS: readonly [StatWindow, StatWindow, StatWindow] = [
  { unit: StatWindowUnit.Days, value: 1 },
  { unit: StatWindowUnit.Days, value: 7 },
  { unit: StatWindowUnit.Days, value: 30 },
];

/** The unit's letter in the compact form a cookie stores (`7d`, `1000b`). */
const UNIT_SUFFIX: Record<StatWindowUnit, string> = {
  [StatWindowUnit.Days]: "d",
  [StatWindowUnit.Battles]: "b",
};

export function isValidStatWindow(w: StatWindow): boolean {
  return (
    Number.isInteger(w.value) &&
    w.value >= 1 &&
    w.value <= STAT_WINDOW_MAX[w.unit]
  );
}

export function sameStatWindow(a: StatWindow, b: StatWindow): boolean {
  return a.unit === b.unit && a.value === b.value;
}

export function formatStatWindow(w: StatWindow): string {
  return `${w.value}${UNIT_SUFFIX[w.unit]}`;
}

/** Reads `7d` / `1000b` back, or null for anything that is not a valid window. */
export function parseStatWindow(raw: string): StatWindow | null {
  const match = /^([1-9]\d{0,4})([db])$/.exec(raw.trim());
  if (!match) return null;
  const unit = match[2] === "d" ? StatWindowUnit.Days : StatWindowUnit.Battles;
  const w = { unit, value: Number(match[1]) };
  return isValidStatWindow(w) ? w : null;
}

/**
 * One period column over a window the reader chose: the same counters and
 * derived figures the profile's 24h/7d/30d columns carry, for exactly one
 * window.
 */
export type PlayerStatWindow = {
  window: StatWindow;
  /** Null when we hold no baseline at all for the account. */
  stats: PlayerPeriodStats | null;
  derived: PeriodDerivedValues;
  /** The instant the window was read back from, which is the account's first
   * snapshot when the window reaches further back than our history. */
  from: Date | null;
  /** The window asked for more than we hold, so the column covers everything
   * since we started tracking the account rather than the whole window. */
  truncated: boolean;
};
