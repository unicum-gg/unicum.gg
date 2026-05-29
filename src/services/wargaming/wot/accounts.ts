import { type Region, WargamingApiError, wgFetch } from ".";

export type PlayerSearchResult = {
  account_id: number;
  nickname: string;
};

export async function findPlayerByNickname(
  region: Region,
  nickname: string,
): Promise<PlayerSearchResult | null> {
  try {
    const data = await wgFetch<PlayerSearchResult[]>(region, "/wot/account/list/", {
      search: nickname,
      type: "exact",
      limit: "1",
    });
    return data[0] ?? null;
  } catch (err) {
    if (err instanceof WargamingApiError && err.code === "INVALID_SEARCH") {
      return null;
    }
    throw err;
  }
}

export type PlayerStatistics = {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  survived_battles: number;
  frags: number;
  damage_dealt: number;
  damage_received: number;
  xp: number;
  battle_avg_xp: number;
  spotted: number;
  capture_points: number;
  dropped_capture_points: number;
  hits: number;
  shots: number;
  hits_percents: number;
  max_xp: number;
  max_damage: number;
  max_frags: number;
};

export type PlayerInfo = {
  account_id: number;
  nickname: string;
  created_at: number;
  last_battle_time: number;
  updated_at: number;
  global_rating: number;
  clan_id: number | null;
  statistics: {
    all: PlayerStatistics;
  };
};

export async function getPlayerInfo(
  region: Region,
  accountId: number,
): Promise<PlayerInfo | null> {
  const data = await wgFetch<Record<string, PlayerInfo | null>>(
    region,
    "/wot/account/info/",
    { account_id: String(accountId) },
  );
  return data[String(accountId)] ?? null;
}

const ACCOUNT_INFO_BATCH_SIZE = 100;

export async function getPlayersInfoBatch(
  region: Region,
  accountIds: number[],
): Promise<Map<number, PlayerInfo>> {
  const out = new Map<number, PlayerInfo>();
  const unique = Array.from(new Set(accountIds));
  for (let i = 0; i < unique.length; i += ACCOUNT_INFO_BATCH_SIZE) {
    const batch = unique.slice(i, i + ACCOUNT_INFO_BATCH_SIZE);
    const data = await wgFetch<Record<string, PlayerInfo | null>>(
      region,
      "/wot/account/info/",
      { account_id: batch.join(",") },
    );
    for (const [id, info] of Object.entries(data)) {
      if (info) out.set(Number(id), info);
    }
  }
  return out;
}

export async function getAccountWTR(
  region: Region,
  accountId: number,
): Promise<number | null> {
  const data = await wgFetch<Record<string, { rating: number } | null>>(
    region,
    "/wot/account/wtr/",
    { account_id: String(accountId) },
  );
  return data[String(accountId)]?.rating ?? null;
}
