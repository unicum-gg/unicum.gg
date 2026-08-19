import { RatingMetric } from "../constants/rating";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  wn7AccAdd,
  wn7AccZero,
  wn7Finalize,
  wn8AccAdd,
  wn8AccZero,
  wn8Finalize,
  wnxAccAdd,
  wnxAccZero,
  wnxFinalize,
  type WN8Expected,
  type WNXExpected,
} from "../wot/ratings";
import type { TankStats } from "../wot/tank-stats";
import type { VehicleMeta } from "../wot/tanks/meta";

// Below this you can't tell if a player is actually that good on the
// tank or just got lucky on a few games. Same threshold as the period
// leaderboards' min battles for the 24h window.
const MIN_BATTLES = 30;
const TOP_N = 5;

// One entry in the lift/drag panel: a tank plus the signed change the overall
// rating would see if the tank were excluded. Computed server-side for the
// active metric only; the removal-delta scan (one aggregate recompute per
// candidate tank) is the most expensive derivation on the player page, so it
// is not precomputed per metric like the vehicle rows are.
export type LiftDragRow = {
  tankId: number;
  name: string;
  tag: string;
  type: string;
  tier: number;
  isPremium: boolean;
  battles: number;
  rating: number;
  // overall_without_this_tank - overall_with_this_tank.
  // Positive => removing the tank lifts the overall (drag candidate).
  // Negative => removing the tank drops the overall (lift candidate).
  removalDelta: number;
};

export type LiftDrag = {
  lift: LiftDragRow[];
  drag: LiftDragRow[];
};

// Lift/drag for all three metrics, so the page payload is metric-agnostic and
// the client picks the active one from its rating-metric cookie. The removal
// scan runs three times (once per metric) at build time, but only inside the
// Redis-cached detail endpoint, so it is paid once per cache window, not per
// navigation.
export type LiftDragByMetric = {
  wn7: LiftDrag | null;
  wn8: LiftDrag | null;
  wnx: LiftDrag | null;
};

function computePerTankRating(
  tank: TankStats,
  meta: VehicleMeta,
  metric: RatingMetric,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
  wn8Fallback: Map<string, WN8Expected>,
  encyclopedia: Record<string, VehicleMeta>,
): number | null {
  const battles = tank.all.battles;
  if (battles <= 0) return null;
  if (metric === RatingMetric.Wn7) {
    return computeWN7(
      {
        battles,
        wins: tank.all.wins,
        frags: tank.all.frags,
        damageDealt: tank.all.damage_dealt,
        spotted: tank.all.spotted,
        droppedCapturePoints: tank.all.dropped_capture_points,
      },
      meta.tier ?? null,
    );
  }
  if (metric === RatingMetric.Wn8) {
    return computeWN8([tank], wn8Expected, encyclopedia, wn8Fallback);
  }
  return computeWNX([tank], wnxExpected);
}

/**
 * A metric's aggregate rating expressed as an additive accumulator: `add` folds
 * one tank in, `finalize` turns the sums into the rating. Because every metric's
 * aggregate is `formula(Σ per-tank terms)`, the roster-minus-one-tank aggregate
 * the lift/drag scan needs is just `finalize(total - thisTank)`, an O(1)
 * subtraction of one tank's accumulator from the pre-summed total, instead of
 * re-summing the whole roster per candidate (the old O(N^2) hot loop). Output is
 * identical to a fresh sum up to floating-point associativity.
 */
type MetricAgg = {
  zero: () => Record<string, number>;
  add: (acc: Record<string, number>, tank: TankStats) => void;
  finalize: (acc: Record<string, number>) => number | null;
};

function makeMetricAgg(
  metric: RatingMetric,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
  wn8Fallback: Map<string, WN8Expected>,
  encyclopedia: Record<string, VehicleMeta>,
): MetricAgg {
  if (metric === RatingMetric.Wn8) {
    return {
      zero: () => wn8AccZero() as unknown as Record<string, number>,
      add: (acc, tank) =>
        wn8AccAdd(acc as never, tank, wn8Expected, encyclopedia, wn8Fallback),
      finalize: (acc) => wn8Finalize(acc as never),
    };
  }
  if (metric === RatingMetric.Wnx) {
    return {
      zero: () => wnxAccZero() as unknown as Record<string, number>,
      add: (acc, tank) => wnxAccAdd(acc as never, tank, wnxExpected),
      finalize: (acc) => wnxFinalize(acc as never),
    };
  }
  return {
    zero: () => wn7AccZero() as unknown as Record<string, number>,
    add: (acc, tank) => wn7AccAdd(acc as never, tank, encyclopedia),
    finalize: (acc) => wn7Finalize(acc as never),
  };
}

// Field-wise `a - b` over two accumulators of the same shape (all-number flat
// records), giving the total with one tank's contribution removed.
function subAcc(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key in a) out[key] = a[key] - (b[key] ?? 0);
  return out;
}

/**
 * For the active metric, finds the tanks propping the overall rating up (lift)
 * and weighing it down (drag): each candidate's removal delta is the overall
 * recomputed without that tank minus the actual overall. Returns null when
 * there is no overall rating or no tank moves the needle.
 */
export function buildLiftDrag(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
  metric: RatingMetric,
): LiftDrag | null {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const agg = makeMetricAgg(
    metric,
    wn8Expected,
    wnxExpected,
    wn8Fallback,
    encyclopedia,
  );

  // Sum the whole roster once; every "without tank i" aggregate is then a single
  // subtraction from this total (O(1)), not a re-sum (O(N)).
  const total = agg.zero();
  for (const tank of tanks) agg.add(total, tank);
  const overall = agg.finalize(total);
  if (overall === null) return null;

  const scored: LiftDragRow[] = [];
  for (const tank of tanks) {
    if (tank.all.battles < MIN_BATTLES) continue;
    const meta = encyclopedia[String(tank.tank_id)] ?? null;
    if (!meta) continue;
    const rating = computePerTankRating(
      tank,
      meta,
      metric,
      wn8Expected,
      wnxExpected,
      wn8Fallback,
      encyclopedia,
    );
    if (rating === null || !Number.isFinite(rating)) continue;

    const thisTank = agg.zero();
    agg.add(thisTank, tank);
    const overallWithout = agg.finalize(subAcc(total, thisTank));
    if (overallWithout === null) continue;
    const removalDelta = overallWithout - overall;
    if (!Number.isFinite(removalDelta) || removalDelta === 0) continue;
    scored.push({
      tankId: tank.tank_id,
      name: meta.name,
      tag: meta.tag,
      type: meta.type,
      tier: meta.tier,
      isPremium: meta.isPremium,
      battles: tank.all.battles,
      rating,
      removalDelta,
    });
  }
  if (scored.length === 0) return null;

  // Negative removalDelta = removing it lowers your overall → it's lifting you.
  // Positive removalDelta = removing it raises your overall → it's dragging you.
  const lift = scored
    .filter((s) => s.removalDelta < 0)
    .sort((a, b) => a.removalDelta - b.removalDelta) // most negative first
    .slice(0, TOP_N);
  const drag = scored
    .filter((s) => s.removalDelta > 0)
    .sort((a, b) => b.removalDelta - a.removalDelta) // most positive first
    .slice(0, TOP_N);

  if (lift.length === 0 && drag.length === 0) return null;
  return { lift, drag };
}
