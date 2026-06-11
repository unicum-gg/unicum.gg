import { RatingMetric } from "@/constants/rating";
import type { VehicleMeta } from "@/services/wargaming/wot/encyclopedia";
import {
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "@/services/wargaming/wot/ratings";
import type { TankStats } from "@/services/wargaming/wot/tanks";

export type RatingContext = {
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wn8Fallback: Map<string, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
};

export function computeTankRating(
  metric: RatingMetric,
  tank: TankStats,
  ctx: RatingContext,
): number | null {
  if (metric === RatingMetric.Wn7) {
    const meta = ctx.encyclopedia[String(tank.tank_id)];
    return computeWN7(
      {
        battles: tank.all.battles,
        wins: tank.all.wins,
        frags: tank.all.frags,
        damageDealt: tank.all.damage_dealt,
        spotted: tank.all.spotted,
        droppedCapturePoints: tank.all.dropped_capture_points,
      },
      meta?.tier ?? null,
    );
  }
  if (metric === RatingMetric.Wn8) {
    return computeWN8([tank], ctx.wn8Expected, ctx.encyclopedia, ctx.wn8Fallback);
  }
  return computeWNX([tank], ctx.wnxExpected);
}

export function computeSlotAggRating(
  metric: RatingMetric,
  tanks: TankStats[],
  ctx: RatingContext,
): number | null {
  if (tanks.length === 0) return null;
  if (metric === RatingMetric.Wn7) {
    let battles = 0;
    let wins = 0;
    let frags = 0;
    let damageDealt = 0;
    let spotted = 0;
    let droppedCapturePoints = 0;
    let weightedTier = 0;
    let battlesWithMeta = 0;
    for (const t of tanks) {
      battles += t.all.battles;
      wins += t.all.wins;
      frags += t.all.frags;
      damageDealt += t.all.damage_dealt;
      spotted += t.all.spotted;
      droppedCapturePoints += t.all.dropped_capture_points;
      const meta = ctx.encyclopedia[String(t.tank_id)];
      if (meta) {
        weightedTier += meta.tier * t.all.battles;
        battlesWithMeta += t.all.battles;
      }
    }
    if (battles === 0) return null;
    const avgTier = battlesWithMeta > 0 ? weightedTier / battlesWithMeta : null;
    return computeWN7(
      { battles, wins, frags, damageDealt, spotted, droppedCapturePoints },
      avgTier,
    );
  }
  if (metric === RatingMetric.Wn8) {
    return computeWN8(tanks, ctx.wn8Expected, ctx.encyclopedia, ctx.wn8Fallback);
  }
  return computeWNX(tanks, ctx.wnxExpected);
}
