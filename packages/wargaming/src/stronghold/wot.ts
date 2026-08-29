import { Region } from "../region";
import type { Transport } from "../client/transport";
import { WargamingHttpError } from "../client/transport";
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

/** One mode's totals on a tier, plus WG's own recent-activity counter. */
export type StrongholdModeStats = {
  battles: number;
  wins: number;
  /** Battles over WG's trailing 28-day window. Zero means the clan has not
   * played this mode recently, which is the freshest activity signal the
   * endpoint carries, no separate probe needed to tell a live clan from a
   * dormant one. */
  battles28d: number;
};

export type ClanStrongholdData = {
  t6: { elo: number; skirmish: StrongholdModeStats | null } | null;
  t8: { elo: number; skirmish: StrongholdModeStats | null } | null;
  t10: {
    elo: number;
    /** Null when WG reports nothing for the mode, which is NOT the same as a
     * measured zero: a clan that only plays Advances has no tier-10 skirmish
     * record at all, and storing 0 for it would claim we measured a mode WG
     * never mentioned. The leaderboard's `IS NOT NULL` gate rests on that
     * distinction, and so does the dash the clan page shows. */
    skirmish: StrongholdModeStats | null;
    advances: StrongholdModeStats | null;
  } | null;
  leaderboard: { tier: number; elo: number; position: number | null }[];
};

/** WG reports wins as a percentage of the battle count, so the absolute win
 * count is derived rather than given. Absent mode stays absent. */
function modeStats(s: TierStats | null | undefined): StrongholdModeStats | null {
  if (!s) return null;
  return {
    battles: s.battles_count,
    wins: Math.round((s.battles_count * s.wins_percent) / 100),
    battles28d: s.battles_count_for_last_28_days,
  };
}

function parseTier(
  d: TierData | undefined,
): { elo: number; skirmish: StrongholdModeStats | null } | null {
  if (!d?.sorties) return null;
  return { elo: d.elo, skirmish: modeStats(d.sorties) };
}

/** Clan Strongholds (dedicated `wgsh-*` game_api host). */
export class StrongholdResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /**
   * One clan's Stronghold record, or `null` when the clan has no Stronghold,
   * which the host reports as a 404 ("This Stronghold is unavailable for the N
   * clan"), a real answer for the majority of clans rather than a failure.
   *
   * Every other error propagates. This used to catch everything and return
   * null, which made "this clan has no Stronghold" and "the host is refusing us"
   * indistinguishable, so a host-wide outage looked exactly like a quiet
   * population of clans without forts and went unnoticed.
   */
  async clan({ clanId }: { clanId: number }): Promise<ClanStrongholdData | null> {
    const url = new URL(
      `https://${WGSH_HOST[this.region]}/game_api/stronghold_info/clan/${clanId}`,
    );
    let json: WgshResponse;
    try {
      json = await this.t.getJson<WgshResponse>(url, {
        region: this.region,
        limit: RateLimit.Stronghold,
      });
    } catch (err) {
      if (err instanceof WargamingHttpError && err.status === 404) return null;
      throw err;
    }
    const t10 = json.stats["10"];
    return {
      t6: parseTier(json.stats["6"]),
      t8: parseTier(json.stats["8"]),
      // Advances (`fort_battles`) only exists on tier 10, and a clan can have
      // played it without any tier-10 skirmish, so the tier is kept as soon as
      // either mode reports.
      t10:
        t10 && (t10.sorties || t10.fort_battles)
          ? {
              elo: t10.elo,
              skirmish: modeStats(t10.sorties),
              advances: modeStats(t10.fort_battles),
            }
          : null,
      leaderboard: json.elo_leaderboards.map((e) => ({
        tier: e.vehicle_level,
        elo: e.elo,
        position: e.position,
      })),
    };
  }
}
