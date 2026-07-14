import type { Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

/** The flat Global Map shape this app stores in clan snapshots. */
export type ClanGlobalMapData = {
  eloT10: number;
  eloT8: number;
  eloT6: number;
  battlesT10: number;
  winsT10: number;
  battlesT8: number;
  winsT8: number;
  battlesT6: number;
  winsT6: number;
  provinces: number;
};

export const fetchClanGlobalMap = async (
  region: Region,
  clanId: number,
): Promise<ClanGlobalMapData | null> => {
  try {
    const info = await wg.region(region).api.wot.globalMap.claninfo({ clanId });
    if (!info) return null;
    return {
      eloT10: info.ratings.elo_10,
      eloT8: info.ratings.elo_8,
      eloT6: info.ratings.elo_6,
      battlesT10: info.statistics.battles_10_level,
      winsT10: info.statistics.wins_10_level,
      battlesT8: info.statistics.battles_8_level,
      winsT8: info.statistics.wins_8_level,
      battlesT6: info.statistics.battles_6_level,
      winsT6: info.statistics.wins_6_level,
      provinces: info.statistics.provinces_count,
    };
  } catch {
    return null;
  }
};
