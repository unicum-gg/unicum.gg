import { applicationIdFor, REGION_API_HOST } from "../fetch";
import type { Region } from "..";

type WgGlobalMapResponse = {
  status: "ok" | "error";
  data: Record<
    string,
    {
      ratings: { elo_10: number; elo_8: number; elo_6: number };
      statistics: {
        battles_10_level: number;
        wins_10_level: number;
        battles_8_level: number;
        wins_8_level: number;
        battles_6_level: number;
        wins_6_level: number;
        provinces_count: number;
      };
    } | null
  >;
};

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

export async function fetchClanGlobalMap(
  region: Region,
  clanId: number,
): Promise<ClanGlobalMapData | null> {
  try {
    const host = REGION_API_HOST[region];
    const res = await fetch(
      `https://${host}/wot/globalmap/claninfo/?application_id=${applicationIdFor(region)}&clan_id=${clanId}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as WgGlobalMapResponse;
    if (json.status !== "ok") return null;
    const entry = json.data[String(clanId)];
    if (!entry) return null;
    return {
      eloT10: entry.ratings.elo_10,
      eloT8: entry.ratings.elo_8,
      eloT6: entry.ratings.elo_6,
      battlesT10: entry.statistics.battles_10_level,
      winsT10: entry.statistics.wins_10_level,
      battlesT8: entry.statistics.battles_8_level,
      winsT8: entry.statistics.wins_8_level,
      battlesT6: entry.statistics.battles_6_level,
      winsT6: entry.statistics.wins_6_level,
      provinces: entry.statistics.provinces_count,
    };
  } catch {
    return null;
  }
}
