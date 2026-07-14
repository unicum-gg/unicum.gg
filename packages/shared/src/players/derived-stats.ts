import type { Stats } from "./stats";
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

// The period diffs feeding the stats table: lifetime stats minus the snapshot
// taken at each cutoff, null when no snapshot that old exists yet.
export type PeriodStats = {
  h24: Stats | null;
  d7: Stats | null;
  d30: Stats | null;
};

// Same idea for the per-tank breakdown (each entry is a diffTanks result).
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

  function perColumn(
    fn: (t: TankStats[] | null) => number | null,
  ): PeriodValues {
    return {
      total: fn(tanks),
      h24: fn(periodTanks.h24),
      d7: fn(periodTanks.d7),
      d30: fn(periodTanks.d30),
    };
  }

  const avgOf =
    (pick: (t: TankStats) => number) =>
    (t: TankStats[] | null): number | null =>
      tankAvg(t, pick);

  const tier = perColumn((t) => (t ? computeAvgTier(t, encyclopedia) : null));

  function wn7For(stats: Stats | null, periodTier: number | null): number | null {
    if (!stats) return null;
    return computeWN7(stats, periodTier);
  }

  return {
    tier,
    trackDamage: perColumn(avgOf((t) => t.all.track_assisted_damage)),
    spottingDamage: perColumn(avgOf((t) => t.all.radio_assisted_damage)),
    assistingDamage: perColumn(
      avgOf((t) => t.all.radio_assisted_damage + t.all.track_assisted_damage),
    ),
    combinedDamage: perColumn(
      avgOf(
        (t) =>
          t.all.damage_dealt +
          t.all.radio_assisted_damage +
          t.all.track_assisted_damage,
      ),
    ),
    wn7: {
      total: wn7For(current, tier.total),
      h24: wn7For(periods.h24, tier.h24),
      d7: wn7For(periods.d7, tier.d7),
      d30: wn7For(periods.d30, tier.d30),
    },
    wn8: perColumn((t) =>
      t ? computeWN8(t, wn8Expected, encyclopedia, wn8Fallback) : null,
    ),
    wnx: perColumn((t) => (t ? computeWNX(t, wnxExpected) : null)),
  };
}
