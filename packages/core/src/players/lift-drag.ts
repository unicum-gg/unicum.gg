import { RatingMetric } from "@unicum.gg/core/constants/rating";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "@unicum.gg/core/wargaming/wot/ratings";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import {
  computeAvgTier,
  type VehicleMeta,
} from "@unicum.gg/core/wargaming/wot/vehicle-meta";

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

function computeAggregateRating(
  tanks: TankStats[],
  metric: RatingMetric,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
  wn8Fallback: Map<string, WN8Expected>,
  encyclopedia: Record<string, VehicleMeta>,
): number | null {
  if (tanks.length === 0) return null;
  if (metric === RatingMetric.Wn8) {
    return computeWN8(tanks, wn8Expected, encyclopedia, wn8Fallback);
  }
  if (metric === RatingMetric.Wnx) {
    return computeWNX(tanks, wnxExpected);
  }
  let battles = 0;
  let wins = 0;
  let frags = 0;
  let damage = 0;
  let spotted = 0;
  let droppedCap = 0;
  for (const tank of tanks) {
    const b = tank.all.battles;
    if (b <= 0) continue;
    battles += b;
    wins += tank.all.wins;
    frags += tank.all.frags;
    damage += tank.all.damage_dealt;
    spotted += tank.all.spotted;
    droppedCap += tank.all.dropped_capture_points;
  }
  if (battles === 0) return null;
  const avgTier = computeAvgTier(tanks, encyclopedia);
  return computeWN7(
    {
      battles,
      wins,
      frags,
      damageDealt: damage,
      spotted,
      droppedCapturePoints: droppedCap,
    },
    avgTier,
  );
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
  const overall = computeAggregateRating(
    tanks,
    metric,
    wn8Expected,
    wnxExpected,
    wn8Fallback,
    encyclopedia,
  );
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

    const tanksWithout = tanks.filter((t) => t.tank_id !== tank.tank_id);
    const overallWithout = computeAggregateRating(
      tanksWithout,
      metric,
      wn8Expected,
      wnxExpected,
      wn8Fallback,
      encyclopedia,
    );
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
