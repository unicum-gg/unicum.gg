import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "@unicum.gg/core/wargaming/wot/ratings";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import type { VehicleMeta } from "@unicum.gg/core/wargaming/wot/vehicle-meta";

// One computed row per tank a player has battles in: vehicle metadata joined
// from the encyclopedia plus derived per-battle stats and all three ratings.
// Kept pure so the player detail endpoint can compute it once server-side
// (instead of shipping the whole encyclopedia + expected-value tables to the
// client). All three ratings are computed so the client can switch the
// displayed metric (WN7/WN8/WNX) without another round-trip.
export type PlayerVehicleRow = {
  tankId: number;
  name: string;
  shortName: string | null;
  tag: string | null;
  tier: number | null;
  nation: string | null;
  type: string | null;
  isPremium: boolean;
  mastery: number | null;
  battles: number;
  avgDamage: number | null;
  avgXp: number | null;
  winrate: number | null;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

export function buildPlayerVehicleRows(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): PlayerVehicleRow[] {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  return tanks
    .filter((t) => t.all.battles > 0)
    .map((tank) => {
      const meta = encyclopedia[String(tank.tank_id)] ?? null;
      const battles = tank.all.battles;
      const avgDamage = tank.all.damage_dealt / battles;
      // A tank with battles > 0 always earned xp, so xp === 0 means the column
      // wasn't populated yet (pre-migration snapshots): show "—", not "0".
      const avgXp =
        Number.isFinite(tank.all.xp) && tank.all.xp > 0
          ? tank.all.xp / battles
          : null;
      return {
        tankId: tank.tank_id,
        name: meta?.name ?? "",
        shortName: meta?.shortName ?? null,
        tag: meta?.tag ?? null,
        tier: meta?.tier ?? null,
        nation: meta?.nation ?? null,
        type: meta?.type ?? null,
        isPremium: meta?.isPremium ?? false,
        mastery: tank.mark_of_mastery ?? null,
        battles,
        avgDamage,
        avgXp,
        winrate: tank.all.wins / battles,
        wn7: computeWN7(
          {
            battles,
            wins: tank.all.wins,
            frags: tank.all.frags,
            damageDealt: tank.all.damage_dealt,
            spotted: tank.all.spotted,
            droppedCapturePoints: tank.all.dropped_capture_points,
          },
          meta?.tier ?? null,
        ),
        wn8: computeWN8([tank], wn8Expected, encyclopedia, wn8Fallback),
        wnx: computeWNX([tank], wnxExpected),
      };
    });
}
