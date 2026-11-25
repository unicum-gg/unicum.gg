import type { PlayerPeriodStats, Stats } from "./stats";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "../wot/ratings";
import type { TankStats } from "../wot/tank-stats";
import {
  computeAvgTier,
  type VehicleMeta,
} from "../wot/tanks/meta";

// The period diffs feeding the stats table, summed from the per-vehicle diffs
// (see `PlayerPeriodStats`), null when no snapshot that old exists yet.
export type PeriodStats = {
  h24: PlayerPeriodStats | null;
  d7: PlayerPeriodStats | null;
  d30: PlayerPeriodStats | null;
};

// Same idea for the per-tank breakdown (each entry is a tankPeriod result).
export type PeriodTanks = {
  h24: TankStats[] | null;
  d7: TankStats[] | null;
  d30: TankStats[] | null;
};

// One value per stats-table column (lifetime total + the three period diffs).
export type PeriodValues = {
  total: number | null;
  h24: number | null;
  d7: number | null;
  d30: number | null;
};

// The stats-table rows that can't be derived from the plain `Stats` snapshots:
// they need the per-tank breakdown joined with the encyclopedia and the
// WN8/WNX expected values. Computed server-side so the client renders numbers
// instead of receiving the whole encyclopedia + expected-value tables.
export type PlayerDerivedStats = {
  tier: PeriodValues;
  trackDamage: PeriodValues;
  spottingDamage: PeriodValues;
  assistingDamage: PeriodValues;
  combinedDamage: PeriodValues;
  wn7: PeriodValues;
  wn8: PeriodValues;
  wnx: PeriodValues;
  /** How many vehicles were played in the column: the whole garage played for
   * the lifetime one, the vehicles that moved for a window. Optional because a
   * profile payload cached before it existed is still served for a while. */
  vehicles?: PeriodValues;
};

function tankAvg(
  tanks: TankStats[] | null,
  fn: (t: TankStats) => number,
): number | null {
  if (!tanks) return null;
  let total = 0;
  let battles = 0;
  for (const t of tanks) {
    total += fn(t);
    battles += t.all.battles;
  }
  return battles > 0 ? total / battles : null;
}

/** The derived figures of ONE column, keyed like `PlayerDerivedStats`. */
export type PeriodDerivedValues = Record<keyof PlayerDerivedStats, number | null>;

/**
 * The derived figures of one column: the lifetime one (the account's totals
 * and its whole garage) or a window (its counters and the per-vehicle diffs).
 * Written once so a window the reader picked is computed exactly like the
 * three the profile ships with.
 */
export function buildPeriodDerived(
  stats: PlayerPeriodStats | null,
  tanks: TankStats[] | null,
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
  wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia),
): PeriodDerivedValues {
  const avgOf = (pick: (t: TankStats) => number) => tankAvg(tanks, pick);
  const tier = tanks ? computeAvgTier(tanks, encyclopedia) : null;
  return {
    tier,
    trackDamage: avgOf((t) => t.all.track_assisted_damage),
    spottingDamage: avgOf((t) => t.all.radio_assisted_damage),
    assistingDamage: avgOf(
      (t) => t.all.radio_assisted_damage + t.all.track_assisted_damage,
    ),
    combinedDamage: avgOf(
      (t) =>
        t.all.damage_dealt +
        t.all.radio_assisted_damage +
        t.all.track_assisted_damage,
    ),
    wn7: stats ? computeWN7(stats, tier) : null,
    wn8: tanks ? computeWN8(tanks, wn8Expected, encyclopedia, wn8Fallback) : null,
    wnx: tanks ? computeWNX(tanks, wnxExpected) : null,
    vehicles: tanks ? tanks.filter((t) => t.all.battles > 0).length : null,
  };
}

export function buildPlayerDerivedStats(
  current: Stats,
  periods: PeriodStats,
  tanks: TankStats[],
  periodTanks: PeriodTanks,
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): PlayerDerivedStats {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const column = (stats: PlayerPeriodStats | null, t: TankStats[] | null) =>
    buildPeriodDerived(stats, t, encyclopedia, wn8Expected, wnxExpected, wn8Fallback);
  const columns = {
    total: column(current, tanks),
    h24: column(periods.h24, periodTanks.h24),
    d7: column(periods.d7, periodTanks.d7),
    d30: column(periods.d30, periodTanks.d30),
  };
  const row = (key: keyof PlayerDerivedStats): PeriodValues => ({
    total: columns.total[key],
    h24: columns.h24[key],
    d7: columns.d7[key],
    d30: columns.d30[key],
  });
  return {
    tier: row("tier"),
    trackDamage: row("trackDamage"),
    spottingDamage: row("spottingDamage"),
    assistingDamage: row("assistingDamage"),
    combinedDamage: row("combinedDamage"),
    wn7: row("wn7"),
    wn8: row("wn8"),
    wnx: row("wnx"),
    vehicles: row("vehicles"),
  };
}
