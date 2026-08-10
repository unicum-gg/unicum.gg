import { Region } from "../region";
import type { Transport } from "../client/transport";
import { RateLimit } from "../client/rate-limiter";

// Stronghold data lives on a dedicated game_api host, distinct from the public
// API and the clan portal.
// The `wgsh-*` host is keyed on Wargaming's INTERNAL realm codes, not the
// public region codes: NA is "us" and Asia is "sg" (Singapore), so `wotna` /
// `wotasia` do not resolve at all (DNS NXDOMAIN). Only EU matches its public
// code. Getting this wrong fails silently -- the transport swallows the
// connection error, `clan()` returns null, and no snapshot is ever written --
// which is why NA/Asia had zero stronghold data.
const WGSH_HOST: Record<Region, string> = {
  [Region.EU]: "wgsh-woteu.wargaming.net",
  [Region.NA]: "wgsh-wotus.wargaming.net",
  [Region.ASIA]: "wgsh-wotsg.wargaming.net",
};

type TierStats = {
  wins_percent: number;
  battles_count: number;
  wins_percent_for_last_28_days: number;
  battles_count_for_last_28_days: number;
};
type TierData = { sorties: TierStats | null; fort_battles: TierStats | null; elo: number };
type WgshResponse = {
  id: number;
  stats: Partial<Record<"6" | "8" | "10", TierData>>;
  elo_leaderboards: { elo: number; vehicle_level: number; battles_count: number; position: number | null }[];
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
  const advancesWins = Math.round((advancesBattles * (d.fort_battles?.wins_percent ?? 0)) / 100);
  return { elo: d.elo, skirmishBattles, skirmishWins, advancesBattles, advancesWins };
}

/** Clan Strongholds (dedicated `wgsh-*` game_api host). */
export class StrongholdResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  async clan({ clanId }: { clanId: number }): Promise<ClanStrongholdData | null> {
    try {
      const url = new URL(
        `https://${WGSH_HOST[this.region]}/game_api/stronghold_info/clan/${clanId}`,
      );
      const json = await this.t.getJson<WgshResponse>(url, {
        region: this.region,
        limit: RateLimit.None,
      });
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
}
