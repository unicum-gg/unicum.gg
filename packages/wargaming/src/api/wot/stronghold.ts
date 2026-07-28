import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";

/** Tier-X-only battle tallies (`battles_for_strongholds_statistics`). */
export type StrongholdBattleStats = {
  last_time_10: number;
  lose_10: number;
  total_10: number;
  total_10_in_28d: number;
  win_10: number;
  win_10_in_28d: number;
};

/** Skirmishes fought against the clan's Stronghold (Tier X only). */
export type StrongholdBattleSeriesStats = {
  lose_10: number;
  total_10: number;
  total_10_in_28d: number;
  win_10: number;
  win_10_in_28d: number;
};

/** The clan's own skirmish tallies, split across Tiers VI / VIII / X. */
export type StrongholdSkirmishStats = {
  last_time_6: number;
  last_time_8: number;
  last_time_10: number;
  lose_6: number;
  lose_8: number;
  lose_10: number;
  total_6: number;
  total_6_in_28d: number;
  total_8: number;
  total_8_in_28d: number;
  total_10: number;
  total_10_in_28d: number;
  win_6: number;
  win_6_in_28d: number;
  win_8: number;
  win_8_in_28d: number;
};

/** One construction site of the Stronghold. */
export type StrongholdBuildingSlot = {
  arena_id: string;
  building_level: number;
  building_title: string;
  direction: string;
  position: string;
  reserve_title: string;
};

/** `/wot/stronghold/claninfo/` — a clan's Stronghold state and battle stats. */
export type StrongholdClanInfo = {
  clan_id: number;
  clan_name: string;
  clan_tag: string;
  command_center_arena_id: string;
  stronghold_buildings_level: number;
  stronghold_level: number;
  battles_for_strongholds_statistics: StrongholdBattleStats;
  battles_series_for_strongholds_statistics: StrongholdBattleSeriesStats;
  building_slots: StrongholdBuildingSlot[];
  skirmish_statistics: StrongholdSkirmishStats;
};

/** Efficiency of a Reserve for a given battle type. */
export type StrongholdReserveBonus = {
  battle_type: string;
  value: number;
};

/** One level of a Reserve currently in stock. */
export type StrongholdReserveStock = {
  action_time: number;
  activated_at: number;
  active_till: number;
  amount: number;
  level: number;
  status: string;
  x_level_only: boolean;
  bonus_values: StrongholdReserveBonus[];
};

/** `/wot/stronghold/clanreserves/` — a Reserve and its available levels. */
export type StrongholdReserve = {
  bonus_type: string;
  disposable: boolean;
  icon: string;
  name: string;
  type: string;
  in_stock: StrongholdReserveStock[];
};

/** `/wot/stronghold/activateclanreserve/` — activation confirmation. */
export type StrongholdReserveActivation = {
  activated_at: number;
};

/** WG limits `stronghold/claninfo` to 10 clan ids per request. */
const CLANINFO_BATCH_SIZE = 10;

/**
 * Official Strongholds API (`/wot/stronghold/*`). Distinct from the
 * `wg.<region>.stronghold` surface, which reads the undocumented `wgsh-*`
 * game_api host; this is the documented public API on the app host.
 */
export class ApiStrongholdResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /**
   * `/wot/stronghold/claninfo/` — a single clan's Stronghold. Battle, defeat
   * and victory counts refresh once every 24h.
   */
  async claninfo<const F extends readonly FieldPath<StrongholdClanInfo>[] = readonly never[]>(params: {
    clanId: number;
    /** Response fields to keep — narrows the return type accordingly. */
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<StrongholdClanInfo, F> | null> {
    const query = buildQuery(params);
    query.clan_id = String(params.clanId);
    const data = await this.t.wgFetch<Record<string, Selected<StrongholdClanInfo, F> | null>>(
      this.region,
      "/wot/stronghold/claninfo/",
      query,
    );
    return data[String(params.clanId)] ?? null;
  }

  /** Batched `claninfo` (WG caps a request at 10 clan ids). */
  async claninfoBatch<const F extends readonly FieldPath<StrongholdClanInfo>[] = readonly never[]>(params: {
    clanIds: number[];
    fields?: F;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<StrongholdClanInfo, F>>> {
    const out = new Map<number, Selected<StrongholdClanInfo, F>>();
    const unique = Array.from(new Set(params.clanIds));
    const query = buildQuery(params);
    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += CLANINFO_BATCH_SIZE) {
      chunks.push(unique.slice(i, i + CLANINFO_BATCH_SIZE));
    }
    await Promise.all(
      chunks.map(async (batch) => {
        const data = await this.t.wgFetch<Record<string, Selected<StrongholdClanInfo, F> | null>>(
          this.region,
          "/wot/stronghold/claninfo/",
          { ...query, clan_id: batch.join(",") },
        );
        for (const [id, value] of Object.entries(data)) {
          if (value != null) out.set(Number(id), value);
        }
      }),
    );
    return out;
  }

  /**
   * `/wot/stronghold/clanreserves/` — the caller's available Reserves and
   * their status. Requires an `access_token` for a member of the clan.
   */
  async clanreserves<const F extends readonly FieldPath<StrongholdReserve>[] = readonly never[]>(params: {
    accessToken: string;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<StrongholdReserve, F>[]> {
    const query = buildQuery(params);
    return this.t.wgFetch<Selected<StrongholdReserve, F>[]>(
      this.region,
      "/wot/stronghold/clanreserves/",
      query,
    );
  }

  /**
   * `/wot/stronghold/activateclanreserve/` — activate a Reserve. The caller
   * must be a clan member with the required permission.
   */
  async activateClanReserve<
    const F extends readonly FieldPath<StrongholdReserveActivation>[] = readonly never[],
  >(params: {
    accessToken: string;
    reserveLevel: number;
    reserveType: string;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<StrongholdReserveActivation, F>> {
    const query = buildQuery(params);
    query.reserve_level = String(params.reserveLevel);
    query.reserve_type = params.reserveType;
    // Write endpoint: WG requires POST (the access token must ride in the form
    // body, like `auth/prolongate`/`auth/logout`); a GET is silently rejected.
    return this.t.wgFetch<Selected<StrongholdReserveActivation, F>>(
      this.region,
      "/wot/stronghold/activateclanreserve/",
      query,
      { method: "POST" },
    );
  }
}
