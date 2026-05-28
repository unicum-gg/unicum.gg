import { env } from "env";

export const REGIONS = ["eu", "na", "asia"] as const;
export type Region = (typeof REGIONS)[number];

export function isRegion(value: string): value is Region {
  return (REGIONS as readonly string[]).includes(value);
}

const REGION_API_HOST: Record<Region, string> = {
  eu: "api.worldoftanks.eu",
  na: "api.worldoftanks.com",
  asia: "api.worldoftanks.asia",
};

export const REGION_LABEL: Record<Region, string> = {
  eu: "EU",
  na: "NA",
  asia: "ASIA",
};

type WgResponse<T> =
  | { status: "ok"; data: T; meta?: { count: number } }
  | { status: "error"; error: { code: number; message: string; field?: string; value?: string } };

export class WargamingApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(`Wargaming API error: ${code}${field ? ` (${field})` : ""}`);
    this.name = "WargamingApiError";
  }
}

async function wgFetch<T>(
  region: Region,
  path: string,
  params: Record<string, string>,
  revalidate = 60,
): Promise<T> {
  const url = new URL(`https://${REGION_API_HOST[region]}${path}`);
  url.searchParams.set("application_id", env.WARGAMING_APPLICATION_ID);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`Wargaming API HTTP ${res.status}: ${res.statusText}`);
  }

  const body = (await res.json()) as WgResponse<T>;
  if (body.status === "error") {
    throw new WargamingApiError(body.error.message, body.error.field);
  }
  return body.data;
}

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
