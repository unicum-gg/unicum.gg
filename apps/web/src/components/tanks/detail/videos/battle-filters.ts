"use client";

import { useMemo, useState } from "react";
import {
  BattleFormat,
  BattleResult,
  type SpawnDirection,
} from "@unicum.gg/shared";
import type { TankVideoCardData } from "./card";

/** The three questions a shot-caller asks of a list of battles, in the order
 * they ask them: what was being played, from which side, and how it went. */
export type BattleFilters = {
  format: BattleFormat | null;
  direction: SpawnDirection | null;
  result: BattleResult | null;
};

const EMPTY: BattleFilters = { format: null, direction: null, result: null };

/**
 * Filters a list of battles by what was played, and says which values are worth
 * offering.
 *
 * The options come from the rows rather than from the enums: a map with no
 * Onslaught battle linked should not offer an Onslaught filter that empties the
 * list, and the same goes for a side nobody has recorded yet. Counts come with
 * them, so a filter says how much it will leave.
 */
export function useBattleFilters(videos: TankVideoCardData[]) {
  const [filters, setFilters] = useState<BattleFilters>(EMPTY);

  const counts = useMemo(() => {
    const formats = new Map<BattleFormat, number>();
    const directions = new Map<SpawnDirection, number>();
    const results = new Map<BattleResult, number>();
    for (const v of videos) {
      const format = v.format ?? BattleFormat.Random;
      formats.set(format, (formats.get(format) ?? 0) + 1);
      if (v.direction) {
        directions.set(v.direction, (directions.get(v.direction) ?? 0) + 1);
      }
      if (v.result) results.set(v.result, (results.get(v.result) ?? 0) + 1);
    }
    return { formats, directions, results };
  }, [videos]);

  const filtered = useMemo(
    () =>
      videos.filter((v) => {
        if (filters.format && (v.format ?? BattleFormat.Random) !== filters.format)
          return false;
        if (filters.direction && v.direction !== filters.direction) return false;
        if (filters.result && v.result !== filters.result) return false;
        return true;
      }),
    [videos, filters],
  );

  function toggle<K extends keyof BattleFilters>(
    key: K,
    value: NonNullable<BattleFilters[K]>,
  ) {
    // A second click on the active value clears it, so the whole bar can be
    // undone without a "clear" button to find.
    setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }));
  }

  const active = Object.values(filters).some(Boolean);

  return { filters, filtered, counts, toggle, active, reset: () => setFilters(EMPTY) };
}
