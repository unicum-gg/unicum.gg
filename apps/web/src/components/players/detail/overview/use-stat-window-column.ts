"use client";

import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";
import {
  DEFAULT_STAT_WINDOWS,
  StatWindowUnit,
  sameStatWindow,
  type PeriodStats,
  type PeriodValues,
  type PeriodDerivedValues,
  type PlayerDerivedStats,
  type PlayerStatWindow,
  type StatWindow,
} from "@unicum.gg/shared";
import { unicum } from "@/services/sdk";
import type { StatColumn } from "./stats-table-rows";

/** The payload column each default window already rides in. */
const PAYLOAD_KEYS = ["h24", "d7", "d30"] as const;
type PayloadKey = (typeof PAYLOAD_KEYS)[number];

/** One column of the server-computed derived figures, keyed by row. */
export function derivedColumn(
  derived: PlayerDerivedStats,
  key: keyof PeriodValues,
): PeriodDerivedValues {
  return {
    tier: derived.tier[key],
    trackDamage: derived.trackDamage[key],
    spottingDamage: derived.spottingDamage[key],
    assistingDamage: derived.assistingDamage[key],
    combinedDamage: derived.combinedDamage[key],
    wn7: derived.wn7[key],
    wn8: derived.wn8[key],
    wnx: derived.wnx[key],
    vehicles: derived.vehicles?.[key] ?? null,
  };
}

function payloadKeyOf(window: StatWindow): PayloadKey | null {
  const index = DEFAULT_STAT_WINDOWS.findIndex((w) => sameStatWindow(w, window));
  return index === -1 ? null : PAYLOAD_KEYS[index];
}

export type StatWindowColumn = {
  /** Null while a custom window is on its way. */
  column: StatColumn | null;
  /** Set only on a custom window, which is the only read that knows. */
  truncated: boolean;
  from: Date | null;
};

/**
 * One period column of the stats table. A window the profile payload already
 * carries (24h, 7d, 30d, in whichever slot the reader put it) is read from
 * it; anything else is asked of the period endpoint, once per window, and
 * cached by SWR so moving between profiles and back costs nothing.
 */
export function useStatWindowColumn({
  region,
  nickname,
  window,
  periods,
  derived,
}: {
  region: Region;
  nickname: string;
  window: StatWindow;
  periods: PeriodStats;
  derived: PlayerDerivedStats;
}): StatWindowColumn {
  const payloadKey = payloadKeyOf(window);
  const request = () =>
    unicum
      .region(region)
      .players(nickname)
      .period(
        window.unit === StatWindowUnit.Days
          ? { days: window.value }
          : { battles: window.value },
      );
  const { data, error } = useSWR(
    payloadKey ? null : request().url(),
    () => request().then((r) => r as unknown as PlayerStatWindow),
    { revalidateOnFocus: false },
  );

  if (payloadKey) {
    return {
      column: {
        stats: periods[payloadKey],
        derived: derivedColumn(derived, payloadKey),
        lifetime: false,
      },
      truncated: false,
      from: null,
    };
  }
  // A failed read is a column of dashes rather than a skeleton forever.
  if (error) {
    return {
      column: { stats: null, derived: null, lifetime: false },
      truncated: false,
      from: null,
    };
  }
  if (!data) return { column: null, truncated: false, from: null };
  return {
    column: { stats: data.stats, derived: data.derived, lifetime: false },
    truncated: data.truncated,
    from: data.from,
  };
}
