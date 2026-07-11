import { after } from "next/server";
import {
  getLatestPlayerSnapshotsByAccounts,
  recordCurrentSnapshot,
} from "@unicum.gg/core/players";
import {
  getLatestTankSnapshotsByAccounts,
  tankSnapshotsToTankStats,
} from "@unicum.gg/core/players/tanks";
import {
  getPlayersInfoBatch,
  type PlayerStatistics,
} from "@unicum.gg/core/wargaming/wot/accounts";
import type { Region } from "@unicum.gg/wargaming/region";
import {
  computeAvgTier,
  type VehicleMeta,
} from "@unicum.gg/core/wargaming/wot/tanks/meta";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "@unicum.gg/core/wargaming/wot/ratings";
import { getTanksStatsBatch, type TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import type { MemberRatings } from "@unicum.gg/core/clans/members";

export type { MemberRatings };

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
  wn8Fallback: Map<string, WN8Expected>,
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
    wn8: computeWN8(tanks, wn8Expected, encyclopedia, wn8Fallback),
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
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);

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
          wn8Fallback,
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
          wn8Fallback,
          wnxExpected,
        ),
      );
      toBackfill.push({ info, tanks });
    }

    if (toBackfill.length > 0) {
      after(async () => {
        for (const { info, tanks } of toBackfill) {
          try {
            // Bulk clan-member backfill: skip the 1 RPS portal marks call
            // (carried forward instead) so it doesn't serialise on the portal.
            await recordCurrentSnapshot(region, info, null, tanks, false);
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
