import type { ClanTankAggregate } from "./tank-aggregate";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "../wot/ratings";
import type { TankStats } from "../wot/tank-stats";
import type { VehicleMeta } from "../wot/tanks/meta";

// One computed row per tank the clan has played: vehicle metadata joined from
// the encyclopedia plus derived per-battle stats and all three ratings. Kept
// pure so the /vehicles endpoint can compute it once server-side (instead of
// shipping the whole encyclopedia + expected-value tables to every client).
// The three ratings are all computed so the client can switch the displayed
// metric (WN7/WN8/WNX) without another round-trip.
export type ClanVehicleRow = {
  tankId: number;
  name: string;
  shortName: string | null;
  tier: number | null;
  nation: string | null;
  type: string | null;
  isPremium: boolean;
  // Carried for the same reason the player rows carry them: the shared tank
  // filter bar narrows on role and on the standard/premium/reward category.
  role: string | null;
  isReward: boolean;
  memberCount: number;
  battles: number;
  avgDamage: number | null;
  avgXp: number | null;
  winrate: number | null;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

export function buildClanVehicleRows(
  aggregates: ClanTankAggregate[],
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): ClanVehicleRow[] {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  return aggregates.map((agg) => {
    const meta = encyclopedia[String(agg.tankId)] ?? null;
    const hasBattles = agg.battles > 0;
    const avgDamage = hasBattles ? agg.damageDealt / agg.battles : null;
    const avgXp = hasBattles && agg.xp > 0 ? agg.xp / agg.battles : null;
    const winrate = hasBattles ? agg.wins / agg.battles : null;

    const synthetic: TankStats = {
      tank_id: agg.tankId,
      mark_of_mastery: null,
      all: {
        battles: agg.battles,
        wins: agg.wins,
        damage_dealt: agg.damageDealt,
        spotted: agg.spotted,
        frags: agg.frags,
        dropped_capture_points: agg.droppedCapturePoints,
        radio_assisted_damage: agg.radioAssistedDamage,
        track_assisted_damage: agg.trackAssistedDamage,
        xp: agg.xp,
      },
    };

    return {
      tankId: agg.tankId,
      name: meta?.name ?? "",
      shortName: meta?.shortName ?? null,
      tier: meta?.tier ?? null,
      nation: meta?.nation ?? null,
      type: meta?.type ?? null,
      isPremium: meta?.isPremium ?? false,
      role: meta?.role ?? null,
      isReward: meta?.isReward ?? false,
      memberCount: agg.memberCount,
      battles: agg.battles,
      avgDamage,
      avgXp,
      winrate,
      wn7: hasBattles
        ? computeWN7(
            {
              battles: agg.battles,
              wins: agg.wins,
              frags: agg.frags,
              damageDealt: agg.damageDealt,
              spotted: agg.spotted,
              droppedCapturePoints: agg.droppedCapturePoints,
            },
            meta?.tier ?? null,
          )
        : null,
      wn8: hasBattles
        ? computeWN8([synthetic], wn8Expected, encyclopedia, wn8Fallback)
        : null,
      wnx: hasBattles ? computeWNX([synthetic], wnxExpected) : null,
    };
  });
}
