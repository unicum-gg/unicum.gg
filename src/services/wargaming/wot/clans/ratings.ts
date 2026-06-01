import { after } from "next/server";
import {
  getLatestPlayerSnapshotsByAccounts,
  recordCurrentSnapshot,
} from "@/services/snapshots/player";
import {
  getLatestTankSnapshotsByAccounts,
  tankSnapshotsToTankStats,
} from "@/services/snapshots/tank";
import {
  getPlayersInfoBatch,
  type PlayerStatistics,
} from "@/services/wargaming/wot/accounts";
import type { Region } from "@/services/wargaming/wot";
import {
  computeAvgTier,
  type VehicleMeta,
} from "@/services/wargaming/wot/encyclopedia";
import {
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "@/services/wargaming/wot/ratings";
import { getTanksStatsBatch, type TankStats } from "@/services/wargaming/wot/tanks";

export type MemberRatings = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

type StatsForWn7 = Pick<
  PlayerStatistics,
  | "battles"
  | "wins"
  | "frags"
  | "damage_dealt"
  | "spotted"
  | "dropped_capture_points"
>;

function computeRatings(
  stats: StatsForWn7,
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): MemberRatings {
  const avgTier = computeAvgTier(tanks, encyclopedia);
  return {
    wn7: computeWN7(
      {
        battles: stats.battles,
        wins: stats.wins,
        frags: stats.frags,
        damageDealt: stats.damage_dealt,
        spotted: stats.spotted,
        droppedCapturePoints: stats.dropped_capture_points,
      },
      avgTier,
    ),
    wn8: computeWN8(tanks, wn8Expected),
    wnx: computeWNX(tanks, wnxExpected),
  };
}

export async function getClanMembersRatings(
  region: Region,
  accountIds: number[],
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): Promise<Map<number, MemberRatings>> {
  const [playerSnaps, tankSnaps] = await Promise.all([
    getLatestPlayerSnapshotsByAccounts(region, accountIds),
    getLatestTankSnapshotsByAccounts(region, accountIds),
  ]);

  const out = new Map<number, MemberRatings>();
  const missing: number[] = [];

  for (const id of accountIds) {
    const ps = playerSnaps.get(id);
    const tanks = tankSnaps.get(id);
    if (ps && tanks && tanks.length > 0) {
      out.set(
        id,
        computeRatings(
          {
            battles: ps.battles,
            wins: ps.wins,
            frags: ps.frags,
            damage_dealt: ps.damageDealt,
            spotted: ps.spotted,
            dropped_capture_points: ps.droppedCapturePoints,
          },
          tankSnapshotsToTankStats(tanks),
          encyclopedia,
          wn8Expected,
          wnxExpected,
        ),
      );
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    const [playersInfo, missingTanksMap] = await Promise.all([
      getPlayersInfoBatch(region, missing),
      getTanksStatsBatch(region, missing).catch<Map<number, TankStats[]>>(
        (err) => {
          console.error("[clan-ratings] tanks/stats batch failed:", err);
          return new Map();
        },
      ),
    ]);

    const toBackfill: Array<{ info: NonNullable<ReturnType<typeof playersInfo.get>>; tanks: TankStats[] }> = [];
    for (const id of missing) {
      const info = playersInfo.get(id);
      const tanks = missingTanksMap.get(id) ?? [];
      if (!info || tanks.length === 0) {
        out.set(id, { wn7: null, wn8: null, wnx: null });
        continue;
      }
      out.set(
        id,
        computeRatings(
          info.statistics.all,
          tanks,
          encyclopedia,
          wn8Expected,
          wnxExpected,
        ),
      );
      toBackfill.push({ info, tanks });
    }

    if (toBackfill.length > 0) {
      after(async () => {
        for (const { info, tanks } of toBackfill) {
          try {
            await recordCurrentSnapshot(region, info, null, tanks);
          } catch (err) {
            console.error(
              `[clan-ratings] backfill snapshot ${info.account_id} failed:`,
              err,
            );
          }
        }
      });
    }
  }

  return out;
}
