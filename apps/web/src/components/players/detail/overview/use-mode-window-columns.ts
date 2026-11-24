"use client";

import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";
import {
  DEFAULT_STAT_WINDOWS,
  StatWindowUnit,
  sameStatWindow,
  type PlayerModeStatWindow,
  type StatWindow,
  type StatWindowMode,
  type StrongholdStats,
} from "@unicum.gg/shared";
import { useStatWindows } from "@/hooks/use-stat-windows";
import { unicum } from "@/services/sdk";

/** The payload column each default window already rides in. */
const PAYLOAD_KEYS = ["h24", "d7", "d30"] as const;

export type ModePeriods = {
  h24: StrongholdStats | null;
  d7: StrongholdStats | null;
  d30: StrongholdStats | null;
};

/** One column of a mode tab. `stats` is undefined while it is on its way. */
export type ModeWindowColumn = {
  stats: StrongholdStats | null | undefined;
  /** The window is not one the payload carries, so anything else computed
   * for the payload's three windows (Skirmish's tiers) does not apply. */
  custom: boolean;
  truncated: boolean;
  from: Date | null;
};

function useModeWindowColumn(
  region: Region,
  nickname: string,
  mode: StatWindowMode,
  window: StatWindow,
  periods: ModePeriods,
): ModeWindowColumn {
  const index = DEFAULT_STAT_WINDOWS.findIndex((w) => sameStatWindow(w, window));
  const request = () =>
    unicum
      .region(region)
      .players(nickname)
      .periodMode({
        mode,
        ...(window.unit === StatWindowUnit.Days
          ? { days: window.value }
          : { battles: window.value }),
      });
  const { data, error } = useSWR(
    index === -1 ? request().url() : null,
    () => request().then((r) => r as unknown as PlayerModeStatWindow),
    { revalidateOnFocus: false },
  );
  if (index !== -1) {
    return { stats: periods[PAYLOAD_KEYS[index]], custom: false, truncated: false, from: null };
  }
  // A failed read is a column of dashes rather than a skeleton forever.
  if (error) return { stats: null, custom: true, truncated: false, from: null };
  return {
    stats: data ? data.stats : undefined,
    custom: true,
    truncated: data?.truncated ?? false,
    from: data?.from ?? null,
  };
}

/**
 * The three period columns of a mode tab, over the windows the reader set on
 * the profile (one choice for the Random table and every mode tab alike). A
 * window the payload carries is read from it; any other from the mode period
 * endpoint, cached by SWR.
 */
export function useModeWindowColumns(
  region: Region,
  nickname: string,
  mode: StatWindowMode,
  periods: ModePeriods,
): readonly [ModeWindowColumn, ModeWindowColumn, ModeWindowColumn] {
  const [windows] = useStatWindows();
  // One call per slot, always three: hooks cannot follow a loop over data.
  return [
    useModeWindowColumn(region, nickname, mode, windows[0], periods),
    useModeWindowColumn(region, nickname, mode, windows[1], periods),
    useModeWindowColumn(region, nickname, mode, windows[2], periods),
  ];
}
