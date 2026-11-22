import { RatingMetric } from "@unicum.gg/shared";
import type {
  TankServerStats,
  TopTankPlayer,
  TopTankPlayersByMetric,
} from "./index";

/**
 * One board across several vehicles that are the same machine (see
 * `getTankTwins`), from each vehicle's own stored board.
 *
 * Exact rather than approximate: a player in the merged top N is in the top N
 * of the vehicle they earned it on, so the union of the stored boards holds
 * every row the merged one can need. A player who owns two of the twins is one
 * person, so they keep their best row and are ranked once.
 */
export function mergeTopPlayersByTank(
  boards: { tankId: number; board: TopTankPlayersByMetric }[],
  limit: number,
): TopTankPlayersByMetric {
  const merge = (metric: RatingMetric): TopTankPlayer[] => {
    const best = new Map<number, TopTankPlayer>();
    for (const { tankId, board } of boards) {
      for (const row of board[metric as keyof TopTankPlayersByMetric] as TopTankPlayer[]) {
        const held = best.get(row.account_id);
        if (!held || row.value > held.value) {
          best.set(row.account_id, { ...row, tank_id: tankId });
        }
      }
    }
    return [...best.values()].sort((a, b) => b.value - a.value).slice(0, limit);
  };
  const stamps = boards
    .map(({ board }) => board.computedAt)
    .filter((at): at is Date => at != null);
  return {
    [RatingMetric.Wn7]: merge(RatingMetric.Wn7),
    [RatingMetric.Wn8]: merge(RatingMetric.Wn8),
    [RatingMetric.Wnx]: merge(RatingMetric.Wnx),
    computedAt: stamps.length > 0 ? stamps[0] : null,
  };
}

/** A weighted mean over the vehicles that carry the field, or null when none. */
function weighted(
  parts: TankServerStats[],
  value: (s: TankServerStats) => number | null,
  weight: (s: TankServerStats) => number,
): number | null {
  let sum = 0;
  let total = 0;
  for (const part of parts) {
    const v = value(part);
    const w = weight(part);
    if (v == null || !Number.isFinite(v) || w <= 0) continue;
    sum += v * w;
    total += w;
  }
  return total > 0 ? sum / total : null;
}

function summed(
  parts: TankServerStats[],
  value: (s: TankServerStats) => number | null,
): number | null {
  const present = parts.map(value).filter((v): v is number => v != null);
  return present.length > 0 ? present.reduce((a, b) => a + b, 0) : null;
}

/**
 * The server averages of several twins read as one vehicle.
 *
 * Only the stored averages are at hand, so each figure is weighted back by what
 * it was averaged over: battles for the per-battle ones (damage, win rate,
 * spots, assist), players for the per-player one (player WR), which recovers
 * the exact pooled value. The ratios over other denominators (KDR over deaths,
 * hit and pen over shots) and the ratings (scored on pooled totals nobody
 * stores) are weighted by battles too, which is an approximation. Twins share
 * every characteristic, so their per-battle shapes match and the gap is a
 * rounding error; on most of them one twin also carries nearly all the battles.
 *
 * The holder counts and `players` are sums. A player who owns two twins counts
 * once on each, which is a few accounts against thousands.
 */
export function combineTankStats(
  parts: TankServerStats[],
): TankServerStats | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  const battlesOf = (s: TankServerStats) =>
    s.total_battles ?? s.avg_battles * s.players;
  const byBattles = (value: (s: TankServerStats) => number | null) =>
    weighted(parts, value, battlesOf);
  const players = parts.reduce((total, s) => total + s.players, 0);
  const totalBattles = parts.reduce((total, s) => total + battlesOf(s), 0);
  return {
    players,
    avg_battles: players > 0 ? totalBattles / players : 0,
    total_battles: parts.every((s) => s.total_battles != null)
      ? totalBattles
      : null,
    avg_damage: byBattles((s) => s.avg_damage) ?? 0,
    winrate: byBattles((s) => s.winrate) ?? 0,
    wn7: byBattles((s) => s.wn7),
    wn8: byBattles((s) => s.wn8),
    wnx: byBattles((s) => s.wnx),
    player_wr: weighted(parts, (s) => s.player_wr, (s) => s.players),
    avg_spots: byBattles((s) => s.avg_spots),
    avg_assist: byBattles((s) => s.avg_assist),
    kdr: byBattles((s) => s.kdr),
    hit_pct: byBattles((s) => s.hit_pct),
    pen_pct: byBattles((s) => s.pen_pct),
    avg_blocked: byBattles((s) => s.avg_blocked),
    survival: byBattles((s) => s.survival),
    moe1: summed(parts, (s) => s.moe1),
    moe2: summed(parts, (s) => s.moe2),
    moe3: summed(parts, (s) => s.moe3),
    mom_class3: summed(parts, (s) => s.mom_class3),
    mom_class2: summed(parts, (s) => s.mom_class2),
    mom_class1: summed(parts, (s) => s.mom_class1),
    mom_ace: summed(parts, (s) => s.mom_ace),
  };
}
