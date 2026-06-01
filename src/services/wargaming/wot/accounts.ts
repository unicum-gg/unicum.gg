import type { Region } from ".";
import { WargamingApiError, wgFetch } from "./fetch";

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

export async function findPlayersByPrefix(
  region: Region,
  prefix: string,
  limit = 10,
): Promise<PlayerSearchResult[]> {
  try {
    return await wgFetch<PlayerSearchResult[]>(region, "/wot/account/list/", {
      search: prefix,
      type: "startswith",
      limit: String(limit),
    });
  } catch (err) {
    if (err instanceof WargamingApiError && err.code === "INVALID_SEARCH") {
      return [];
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

async function fetchAccountInfoChunk(
  region: Region,
  ids: number[],
  out: Map<number, PlayerInfo>,
): Promise<void> {
  if (ids.length === 0) return;
  try {
    const data = await wgFetch<Record<string, PlayerInfo | null>>(
      region,
      "/wot/account/info/",
      { account_id: ids.join(",") },
    );
    for (const [id, info] of Object.entries(data)) {
      if (info) out.set(Number(id), info);
    }
  } catch (err) {
    if (
      err instanceof WargamingApiError &&
      err.code === "INVALID_ACCOUNT_ID" &&
      ids.length > 1
    ) {
      const mid = Math.floor(ids.length / 2);
      await Promise.all([
        fetchAccountInfoChunk(region, ids.slice(0, mid), out),
        fetchAccountInfoChunk(region, ids.slice(mid), out),
      ]);
      return;
    }
    if (err instanceof WargamingApiError && err.code === "INVALID_ACCOUNT_ID") return;
    throw err;
  }
}

export async function getPlayersInfoBatch(
  region: Region,
  accountIds: number[],
): Promise<Map<number, PlayerInfo>> {
  const out = new Map<number, PlayerInfo>();
  const unique = Array.from(new Set(accountIds));
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += ACCOUNT_INFO_BATCH_SIZE) {
    chunks.push(unique.slice(i, i + ACCOUNT_INFO_BATCH_SIZE));
  }
  await Promise.all(chunks.map((batch) => fetchAccountInfoChunk(region, batch, out)));
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

const ACCOUNT_WTR_BATCH_SIZE = 100;

async function fetchWtrChunk(
  region: Region,
  ids: number[],
  out: Map<number, number>,
): Promise<void> {
  if (ids.length === 0) return;
  try {
    const data = await wgFetch<Record<string, { rating: number } | null>>(
      region,
      "/wot/account/wtr/",
      { account_id: ids.join(",") },
    );
    for (const [id, entry] of Object.entries(data)) {
      if (entry?.rating != null) out.set(Number(id), entry.rating);
    }
  } catch (err) {
    if (
      err instanceof WargamingApiError &&
      err.code === "INVALID_ACCOUNT_ID" &&
      ids.length > 1
    ) {
      const mid = Math.floor(ids.length / 2);
      await Promise.all([
        fetchWtrChunk(region, ids.slice(0, mid), out),
        fetchWtrChunk(region, ids.slice(mid), out),
      ]);
      return;
    }
    if (err instanceof WargamingApiError && err.code === "INVALID_ACCOUNT_ID") return;
    throw err;
  }
}

export async function getAccountsWTRBatch(
  region: Region,
  accountIds: number[],
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const unique = Array.from(new Set(accountIds));
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += ACCOUNT_WTR_BATCH_SIZE) {
    chunks.push(unique.slice(i, i + ACCOUNT_WTR_BATCH_SIZE));
  }
  await Promise.all(chunks.map((batch) => fetchWtrChunk(region, batch, out)));
  return out;
}
