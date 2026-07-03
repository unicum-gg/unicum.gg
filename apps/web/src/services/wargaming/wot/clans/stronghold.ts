import type { Region } from "..";

const WGSH_HOST: Record<Region, string> = {
  eu: "wgsh-woteu.wargaming.net",
  na: "wgsh-wotna.wargaming.net",
  asia: "wgsh-wotasia.wargaming.net",
};

type TierStats = {
  wins_percent: number;
  battles_count: number;
  wins_percent_for_last_28_days: number;
  battles_count_for_last_28_days: number;
};

type TierData = {
  sorties: TierStats | null;
  fort_battles: TierStats | null;
  elo: number;
};

type WgshResponse = {
  id: number;
  stats: Partial<Record<"6" | "8" | "10", TierData>>;
  elo_leaderboards: {
    elo: number;
    vehicle_level: number;
    battles_count: number;
    position: number | null;
  }[];
};

export type ClanStrongholdData = {
  t6: { elo: number; skirmishBattles: number; skirmishWins: number } | null;
  t8: { elo: number; skirmishBattles: number; skirmishWins: number } | null;
  t10: {
    elo: number;
    skirmishBattles: number;
    skirmishWins: number;
    advancesBattles: number;
    advancesWins: number;
  } | null;
  leaderboard: { tier: number; elo: number; position: number | null }[];
};

function parseTier(
  d: TierData | undefined,
  withAdvances: false,
): { elo: number; skirmishBattles: number; skirmishWins: number } | null;
function parseTier(
  d: TierData | undefined,
  withAdvances: true,
): {
  elo: number;
  skirmishBattles: number;
  skirmishWins: number;
  advancesBattles: number;
  advancesWins: number;
} | null;
function parseTier(d: TierData | undefined, withAdvances: boolean) {
  if (!d?.sorties) return null;
  const skirmishBattles = d.sorties.battles_count;
  const skirmishWins = Math.round((skirmishBattles * d.sorties.wins_percent) / 100);
  if (!withAdvances) return { elo: d.elo, skirmishBattles, skirmishWins };
  const advancesBattles = d.fort_battles?.battles_count ?? 0;
  const advancesWins = Math.round(
    (advancesBattles * (d.fort_battles?.wins_percent ?? 0)) / 100,
  );
  return { elo: d.elo, skirmishBattles, skirmishWins, advancesBattles, advancesWins };
}

export async function fetchClanStronghold(
  region: Region,
  clanId: number,
): Promise<ClanStrongholdData | null> {
  try {
    const res = await fetch(
      `https://${WGSH_HOST[region]}/game_api/stronghold_info/clan/${clanId}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as WgshResponse;
    return {
      t6: parseTier(json.stats["6"], false),
      t8: parseTier(json.stats["8"], false),
      t10: parseTier(json.stats["10"], true),
      leaderboard: json.elo_leaderboards.map((e) => ({
        tier: e.vehicle_level,
        elo: e.elo,
        position: e.position,
      })),
    };
  } catch {
    return null;
  }
}
