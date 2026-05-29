import { getPlayersInfoBatch } from "@/services/wargaming/wot/accounts";
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
import { getTanksStats, type TankStats } from "@/services/wargaming/wot/tanks";

export type MemberRatings = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

const TANKS_STATS_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export async function getClanMembersRatings(
  region: Region,
  accountIds: number[],
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): Promise<Map<number, MemberRatings>> {
  const [playersInfo, tanksList] = await Promise.all([
    getPlayersInfoBatch(region, accountIds),
    mapWithConcurrency(accountIds, TANKS_STATS_CONCURRENCY, (id) =>
      getTanksStats(region, id).catch<TankStats[]>((err) => {
        console.error(`[clan-ratings] tanks/stats ${id} failed:`, err);
        return [];
      }),
    ),
  ]);

  const out = new Map<number, MemberRatings>();
  accountIds.forEach((id, i) => {
    const info = playersInfo.get(id);
    const tanks = tanksList[i];
    if (!info || tanks.length === 0) {
      out.set(id, { wn7: null, wn8: null, wnx: null });
      return;
    }
    const avgTier = computeAvgTier(tanks, encyclopedia);
    const s = info.statistics.all;
    out.set(id, {
      wn7: computeWN7(
        {
          battles: s.battles,
          wins: s.wins,
          frags: s.frags,
          damageDealt: s.damage_dealt,
          spotted: s.spotted,
          droppedCapturePoints: s.dropped_capture_points,
        },
        avgTier,
      ),
      wn8: computeWN8(tanks, wn8Expected),
      wnx: computeWNX(tanks, wnxExpected),
    });
  });
  return out;
}
