import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";

/** Season/event lifecycle status, for the `status` filter of `seasons`/`events`. */
export enum GlobalMapStatus {
  Planned = "PLANNED",
  Active = "ACTIVE",
  Finished = "FINISHED",
}

/** The vehicle Tiers the Global Map is played on. */
export enum GlobalMapVehicleLevel {
  Tier6 = 6,
  Tier8 = 8,
  Tier10 = 10,
}

/** Province landing type, for the `landing_type` filter of `provinces`. */
export enum GlobalMapLandingType {
  Auction = "auction",
  Tournament = "tournament",
}

/** Sort order for `provinces` (`order_by`). */
export enum GlobalMapProvinceOrder {
  ProvinceId = "province_id",
  ProvinceIdDesc = "-province_id",
  DailyRevenue = "daily_revenue",
  DailyRevenueDesc = "-daily_revenue",
  PrimeHour = "prime_hour",
  PrimeHourDesc = "-prime_hour",
}

/** `/wot/globalmap/info/` — overall map status. */
export type GlobalMapInfo = {
  last_turn: number;
  last_turn_calculated_at: number;
  last_turn_created_at: number;
  /** `active`, `frozen` or `turn_calculation_in_progress`. */
  state: string;
};

/** A module (consumable) available on a Front. */
export type GlobalMapExtension = {
  cost: number;
  description_strategic: string;
  description_tactical: string;
  extension_id: string;
  name: string;
  wage: number;
};

/** `/wot/globalmap/fronts/` — a Front. */
export type GlobalMapFront = {
  avg_clans_rating: number;
  avg_min_bet: number;
  avg_won_bet: number;
  battle_time_limit: number;
  division_cost: number;
  fog_of_war: boolean;
  front_id: string;
  front_name: string;
  is_active: boolean;
  is_event: boolean;
  max_tanks_per_division: number;
  max_vehicle_level: number;
  min_tanks_per_division: number;
  min_vehicle_level: number;
  provinces_count: number;
  vehicle_freeze: boolean;
  available_extensions: GlobalMapExtension[];
};

/** One side of an active province battle. */
export type GlobalMapProvinceBattleClan = {
  battle_reward: number;
  clan_id: number;
  loose_elo_delta: number;
  win_elo_delta: number;
};

/** A battle currently taking place over a province. */
export type GlobalMapProvinceActiveBattle = {
  battle_reward: number;
  round: number;
  start_at: string;
  clan_a: GlobalMapProvinceBattleClan;
  clan_b: GlobalMapProvinceBattleClan;
};

/** `/wot/globalmap/provinces/` — a province and its current battles. */
export type GlobalMapProvince = {
  arena_id: string;
  arena_name: string;
  attackers: number[];
  battles_start_at: string;
  competitors: number[];
  current_min_bet: number;
  daily_revenue: number;
  front_id: string;
  front_name: string;
  is_borders_disabled: boolean;
  landing_type: string;
  last_won_bet: number;
  max_bets: number;
  neighbours: string[];
  owner_clan_id: number;
  pillage_end_at: string;
  prime_time: string;
  province_id: string;
  province_name: string;
  revenue_level: number;
  round_number: number;
  server: string;
  status: string;
  uri: string;
  world_redivision: boolean;
  active_battles: GlobalMapProvinceActiveBattle[];
};

/** Clan Elo ratings per division (`claninfo`). */
export type GlobalMapClanRatings = {
  elo_6: number;
  elo_8: number;
  elo_10: number;
  updated_at: number;
};

/** Clan aggregate statistics on the Global Map (`claninfo`). */
export type GlobalMapClanStatistics = {
  battles: number;
  battles_6_level: number;
  battles_8_level: number;
  battles_10_level: number;
  captures: number;
  losses: number;
  provinces_count: number;
  wins: number;
  wins_6_level: number;
  wins_8_level: number;
  wins_10_level: number;
};

/** `/wot/globalmap/claninfo/` — a clan on the Global Map. */
export type GlobalMapClanInfo = {
  clan_id: number;
  name: string;
  tag: string;
  private: { daily_wage: number; influence: number } | null;
  ratings: GlobalMapClanRatings;
  statistics: GlobalMapClanStatistics;
};

/** `/wot/globalmap/clanprovinces/` — a province owned by a clan. */
export type GlobalMapClanProvince = {
  arena_id: string;
  arena_name: string;
  clan_id: number;
  daily_revenue: number;
  front_id: string;
  front_name: string;
  landing_type: string;
  max_vehicle_level: number;
  pillage_end_at: string;
  prime_time: string;
  province_id: string;
  province_name: string;
  revenue_level: number;
  turns_owned: number;
  private: { hq_connected: boolean; is_revenue_limit_exceeded: boolean } | null;
};

/** `/wot/globalmap/clanbattles/` — one battle in a clan's history. */
export type GlobalMapClanBattle = {
  /** `ground`, `auction` or `tournament`. */
  attack_type: string;
  competitor_id: number;
  front_id: string;
  front_name: string;
  province_id: string;
  province_name: string;
  time: number;
  /** `attack` or `defense`. */
  type: string;
  vehicle_level: number;
};

/** A Front referenced by a season or event. */
export type GlobalMapScheduleFront = {
  front_id: string;
  front_name: string;
  url: string;
};

/** `/wot/globalmap/seasons/` — a season. */
export type GlobalMapSeason = {
  end: string;
  season_id: string;
  season_name: string;
  start: string;
  status: string;
  fronts: GlobalMapScheduleFront[];
};

/** Per-tier clan stats within a season (`seasonclaninfo`). */
export type GlobalMapSeasonClanStat = {
  battles: number;
  elo: number;
  rank: number;
  rank_delta: number;
  vehicle_level: number;
  victory_points: number;
  victory_points_since_turn: number;
  wins: number;
};

/** `/wot/globalmap/seasonclaninfo/` — a clan's per-season, per-tier stats. */
export type GlobalMapSeasonClanInfo = {
  seasons: Record<string, GlobalMapSeasonClanStat[]>;
};

/** Per-tier account stats within a season (`seasonaccountinfo`). */
export type GlobalMapSeasonAccountStat = {
  account_id: number;
  award_level: string;
  battles: number;
  battles_to_award: number;
  clan_id: number;
  clan_rank: number;
  season_id: string;
  updated_at: number;
  vehicle_level: number;
};

/** `/wot/globalmap/seasonaccountinfo/` — an account's per-season, per-tier stats. */
export type GlobalMapSeasonAccountInfo = {
  seasons: Record<string, GlobalMapSeasonAccountStat[]>;
};

/** A clan row in a season rating (`seasonrating`, `seasonratingneighbors`). */
export type GlobalMapSeasonRatingEntry = {
  award_level: string;
  clan_id: number;
  color: string;
  name: string;
  rank: number;
  rank_delta: number;
  tag: string;
  updated_at: number;
  victory_points: number;
  victory_points_to_next_award: number;
};

/** `/wot/globalmap/events/` — an event. */
export type GlobalMapEvent = {
  end: string;
  event_id: string;
  event_name: string;
  start: string;
  status: string;
  fronts: GlobalMapScheduleFront[];
};

/** Per-front clan stats within an event (`eventclaninfo`). */
export type GlobalMapEventClanStat = {
  battle_fame_points: number;
  battles: number;
  event_id: string;
  fame_points: number;
  fame_points_since_turn: number;
  front_id: string;
  rank: number;
  rank_delta: number;
  task_fame_points: number;
  url: string;
  wins: number;
};

/** `/wot/globalmap/eventclaninfo/` — a clan's per-event, per-front stats. */
export type GlobalMapEventClanInfo = {
  events: Record<string, GlobalMapEventClanStat[]>;
};

/** Per-front account stats within an event (`eventaccountinfo`). */
export type GlobalMapEventAccountStat = {
  account_id: number;
  award_level: string;
  battles: number;
  battles_to_award: number;
  clan_id: number;
  clan_rank: number;
  event_id: string;
  fame_points: number;
  fame_points_since_turn: number;
  fame_points_to_improve_award: number;
  front_id: string;
  rank: number;
  rank_delta: number;
  updated_at: number;
  url: string;
};

/** `/wot/globalmap/eventaccountinfo/` — an account's per-event, per-front stats. */
export type GlobalMapEventAccountInfo = {
  events: Record<string, GlobalMapEventAccountStat[]>;
};

/** An account row in an event rating (`eventaccountratings`, `…neighbors`). */
export type GlobalMapEventAccountRatingEntry = {
  account_id: number;
  award_level: string;
  battles: number;
  battles_to_award: number;
  clan_id: number;
  clan_rank: number;
  event_id: string;
  fame_points: number;
  fame_points_to_improve_award: number;
  front_id: string;
  rank: number;
  rank_delta: number;
  updated_at: number;
  url: string;
};

/** A clan row in an event rating (`eventrating`, `eventratingneighbors`). */
export type GlobalMapEventRatingEntry = {
  award_level: string;
  battle_fame_points: number;
  clan_id: number;
  color: string;
  fame_points_to_improve_award: number;
  name: string;
  rank: number;
  rank_delta: number;
  tag: string;
  task_fame_points: number;
  total_fame_points: number;
  updated_at: number;
};

/** WG caps `claninfo`/`clanprovinces` at 10 clan ids per request. */
const CLAN_BATCH_SIZE = 10;

const serializeTiers = (
  level: GlobalMapVehicleLevel | readonly GlobalMapVehicleLevel[],
): string => (Array.isArray(level) ? level.join(",") : String(level));

/** `/wot/globalmap/*` — Global Map (Clan Wars) status, provinces and ratings. */
export class GlobalMapResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** `/wot/globalmap/info/` — overall map status. */
  async info<const F extends readonly FieldPath<GlobalMapInfo>[] = readonly never[]>(
    params: { fields?: F } = {},
  ): Promise<Selected<GlobalMapInfo, F>> {
    return this.t.wgFetch<Selected<GlobalMapInfo, F>>(
      this.region,
      "/wot/globalmap/info/",
      buildQuery(params),
    );
  }

  /** `/wot/globalmap/fronts/` — the map's Fronts. */
  async fronts<const F extends readonly FieldPath<GlobalMapFront>[] = readonly never[]>(params: {
    frontId?: readonly string[];
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Selected<GlobalMapFront, F>[]> {
    const query = buildQuery(params);
    if (params.frontId?.length) query.front_id = params.frontId.join(",");
    return this.t.wgFetch<Selected<GlobalMapFront, F>[]>(
      this.region,
      "/wot/globalmap/fronts/",
      query,
    );
  }

  /** `/wot/globalmap/provinces/` — provinces of a Front, with rich filters. */
  async provinces<const F extends readonly FieldPath<GlobalMapProvince>[] = readonly never[]>(params: {
    frontId: string;
    arenaId?: string;
    dailyRevenueGte?: number;
    dailyRevenueLte?: number;
    landingType?: GlobalMapLandingType;
    orderBy?: GlobalMapProvinceOrder;
    primeHour?: number;
    provinceId?: readonly string[];
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<GlobalMapProvince, F>[]> {
    const query = buildQuery(params);
    query.front_id = params.frontId;
    if (params.arenaId) query.arena_id = params.arenaId;
    if (params.dailyRevenueGte !== undefined) query.daily_revenue_gte = String(params.dailyRevenueGte);
    if (params.dailyRevenueLte !== undefined) query.daily_revenue_lte = String(params.dailyRevenueLte);
    if (params.landingType) query.landing_type = params.landingType;
    if (params.primeHour !== undefined) query.prime_hour = String(params.primeHour);
    if (params.provinceId?.length) query.province_id = params.provinceId.join(",");
    return this.t.wgFetch<Selected<GlobalMapProvince, F>[]>(
      this.region,
      "/wot/globalmap/provinces/",
      query,
    );
  }

  /** `/wot/globalmap/claninfo/` — a clan's Global Map data. */
  async claninfo<const F extends readonly FieldPath<GlobalMapClanInfo>[] = readonly never[]>(params: {
    clanId: number;
    accessToken?: string;
    fields?: F;
  }): Promise<Selected<GlobalMapClanInfo, F> | null> {
    const query = buildQuery(params);
    query.clan_id = String(params.clanId);
    const data = await this.t.wgFetch<Record<string, Selected<GlobalMapClanInfo, F> | null>>(
      this.region,
      "/wot/globalmap/claninfo/",
      query,
    );
    return data[String(params.clanId)] ?? null;
  }

  /** Batched `claninfo` (WG caps a request at 10 clan ids). */
  async claninfoBatch<const F extends readonly FieldPath<GlobalMapClanInfo>[] = readonly never[]>(params: {
    clanIds: number[];
    accessToken?: string;
    fields?: F;
  }): Promise<Map<number, Selected<GlobalMapClanInfo, F>>> {
    const out = new Map<number, Selected<GlobalMapClanInfo, F>>();
    const unique = Array.from(new Set(params.clanIds));
    const query = buildQuery(params);
    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += CLAN_BATCH_SIZE) {
      chunks.push(unique.slice(i, i + CLAN_BATCH_SIZE));
    }
    await Promise.all(
      chunks.map(async (batch) => {
        const data = await this.t.wgFetch<Record<string, Selected<GlobalMapClanInfo, F> | null>>(
          this.region,
          "/wot/globalmap/claninfo/",
          { ...query, clan_id: batch.join(",") },
        );
        for (const [id, value] of Object.entries(data)) {
          if (value != null) out.set(Number(id), value);
        }
      }),
    );
    return out;
  }

  /** `/wot/globalmap/clanprovinces/` — provinces currently owned by a clan. */
  async clanprovinces<const F extends readonly FieldPath<GlobalMapClanProvince>[] = readonly never[]>(params: {
    clanId: number;
    accessToken?: string;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<GlobalMapClanProvince, F>[]> {
    const query = buildQuery(params);
    query.clan_id = String(params.clanId);
    const data = await this.t.wgFetch<Record<string, Selected<GlobalMapClanProvince, F>[] | null>>(
      this.region,
      "/wot/globalmap/clanprovinces/",
      query,
    );
    return data[String(params.clanId)] ?? [];
  }

  /** `/wot/globalmap/clanbattles/` — a clan's Global Map battle history. */
  async clanbattles<const F extends readonly FieldPath<GlobalMapClanBattle>[] = readonly never[]>(params: {
    clanId: number;
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<GlobalMapClanBattle, F>[]> {
    const query = buildQuery(params);
    query.clan_id = String(params.clanId);
    const data = await this.t.wgFetch<Record<string, Selected<GlobalMapClanBattle, F>[] | null>>(
      this.region,
      "/wot/globalmap/clanbattles/",
      query,
    );
    return data[String(params.clanId)] ?? [];
  }

  /** `/wot/globalmap/seasons/` — seasons (optionally filtered by status). */
  async seasons<const F extends readonly FieldPath<GlobalMapSeason>[] = readonly never[]>(params: {
    seasonId?: string;
    status?: GlobalMapStatus;
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Selected<GlobalMapSeason, F>[]> {
    const query = buildQuery(params);
    if (params.seasonId) query.season_id = params.seasonId;
    if (params.status) query.status = params.status;
    return this.t.wgFetch<Selected<GlobalMapSeason, F>[]>(
      this.region,
      "/wot/globalmap/seasons/",
      query,
    );
  }

  /** `/wot/globalmap/seasonclaninfo/` — a clan's per-tier stats for a season. */
  async seasonclaninfo<const F extends readonly FieldPath<GlobalMapSeasonClanInfo>[] = readonly never[]>(params: {
    clanId: number;
    seasonId: string;
    vehicleLevel: GlobalMapVehicleLevel | readonly GlobalMapVehicleLevel[];
    fields?: F;
  }): Promise<Selected<GlobalMapSeasonClanInfo, F> | null> {
    const query = buildQuery(params);
    query.clan_id = String(params.clanId);
    query.season_id = params.seasonId;
    query.vehicle_level = serializeTiers(params.vehicleLevel);
    const data = await this.t.wgFetch<Record<string, Selected<GlobalMapSeasonClanInfo, F> | null>>(
      this.region,
      "/wot/globalmap/seasonclaninfo/",
      query,
    );
    return data[String(params.clanId)] ?? null;
  }

  /** `/wot/globalmap/seasonaccountinfo/` — an account's per-tier stats for a season. */
  async seasonaccountinfo<const F extends readonly FieldPath<GlobalMapSeasonAccountInfo>[] = readonly never[]>(params: {
    accountId: number;
    seasonId: string;
    vehicleLevel: GlobalMapVehicleLevel | readonly GlobalMapVehicleLevel[];
    fields?: F;
  }): Promise<Selected<GlobalMapSeasonAccountInfo, F> | null> {
    const query = buildQuery(params);
    query.account_id = String(params.accountId);
    query.season_id = params.seasonId;
    query.vehicle_level = serializeTiers(params.vehicleLevel);
    const data = await this.t.wgFetch<Record<string, Selected<GlobalMapSeasonAccountInfo, F> | null>>(
      this.region,
      "/wot/globalmap/seasonaccountinfo/",
      query,
    );
    return data[String(params.accountId)] ?? null;
  }

  /** `/wot/globalmap/seasonrating/` — clan leaderboard for a season and tier. */
  async seasonrating<const F extends readonly FieldPath<GlobalMapSeasonRatingEntry>[] = readonly never[]>(params: {
    seasonId: string;
    vehicleLevel: GlobalMapVehicleLevel;
    limit?: number;
    pageNo?: number;
    fields?: F;
  }): Promise<Selected<GlobalMapSeasonRatingEntry, F>[]> {
    const query = buildQuery(params);
    query.season_id = params.seasonId;
    query.vehicle_level = String(params.vehicleLevel);
    return this.t.wgFetch<Selected<GlobalMapSeasonRatingEntry, F>[]>(
      this.region,
      "/wot/globalmap/seasonrating/",
      query,
    );
  }

  /** `/wot/globalmap/seasonratingneighbors/` — clans adjacent to one in a season rating. */
  async seasonratingneighbors<const F extends readonly FieldPath<GlobalMapSeasonRatingEntry>[] = readonly never[]>(params: {
    clanId: number;
    seasonId: string;
    vehicleLevel: GlobalMapVehicleLevel;
    limit?: number;
    fields?: F;
  }): Promise<Selected<GlobalMapSeasonRatingEntry, F>[]> {
    const query = buildQuery(params);
    query.clan_id = String(params.clanId);
    query.season_id = params.seasonId;
    query.vehicle_level = String(params.vehicleLevel);
    return this.t.wgFetch<Selected<GlobalMapSeasonRatingEntry, F>[]>(
      this.region,
      "/wot/globalmap/seasonratingneighbors/",
      query,
    );
  }

  /** `/wot/globalmap/events/` — events (optionally filtered by status). */
  async events<const F extends readonly FieldPath<GlobalMapEvent>[] = readonly never[]>(params: {
    eventId?: string;
    status?: GlobalMapStatus;
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Selected<GlobalMapEvent, F>[]> {
    const query = buildQuery(params);
    if (params.eventId) query.event_id = params.eventId;
    if (params.status) query.status = params.status;
    return this.t.wgFetch<Selected<GlobalMapEvent, F>[]>(
      this.region,
      "/wot/globalmap/events/",
      query,
    );
  }

  /** `/wot/globalmap/eventclaninfo/` — a clan's per-front stats for an event. */
  async eventclaninfo<const F extends readonly FieldPath<GlobalMapEventClanInfo>[] = readonly never[]>(params: {
    clanId: number;
    eventId: string;
    frontId: readonly string[];
    fields?: F;
  }): Promise<Selected<GlobalMapEventClanInfo, F> | null> {
    const query = buildQuery(params);
    query.clan_id = String(params.clanId);
    query.event_id = params.eventId;
    query.front_id = params.frontId.join(",");
    const data = await this.t.wgFetch<Record<string, Selected<GlobalMapEventClanInfo, F> | null>>(
      this.region,
      "/wot/globalmap/eventclaninfo/",
      query,
    );
    return data[String(params.clanId)] ?? null;
  }

  /** `/wot/globalmap/eventaccountinfo/` — an account's per-front stats for an event. */
  async eventaccountinfo<const F extends readonly FieldPath<GlobalMapEventAccountInfo>[] = readonly never[]>(params: {
    accountId: number;
    eventId: string;
    frontId: readonly string[];
    clanId?: number;
    fields?: F;
  }): Promise<Selected<GlobalMapEventAccountInfo, F> | null> {
    const query = buildQuery(params);
    query.account_id = String(params.accountId);
    query.event_id = params.eventId;
    query.front_id = params.frontId.join(",");
    if (params.clanId !== undefined) query.clan_id = String(params.clanId);
    const data = await this.t.wgFetch<Record<string, Selected<GlobalMapEventAccountInfo, F> | null>>(
      this.region,
      "/wot/globalmap/eventaccountinfo/",
      query,
    );
    return data[String(params.accountId)] ?? null;
  }

  /** `/wot/globalmap/eventaccountratings/` — account leaderboard for an event Front. */
  async eventaccountratings<const F extends readonly FieldPath<GlobalMapEventAccountRatingEntry>[] = readonly never[]>(params: {
    eventId: string;
    frontId: string;
    inRating?: boolean;
    limit?: number;
    pageNo?: number;
    fields?: F;
  }): Promise<Selected<GlobalMapEventAccountRatingEntry, F>[]> {
    const query = buildQuery(params);
    query.event_id = params.eventId;
    query.front_id = params.frontId;
    if (params.inRating) query.in_rating = "1";
    return this.t.wgFetch<Selected<GlobalMapEventAccountRatingEntry, F>[]>(
      this.region,
      "/wot/globalmap/eventaccountratings/",
      query,
    );
  }

  /** `/wot/globalmap/eventaccountratingneighbors/` — accounts adjacent to one in an event rating. */
  async eventaccountratingneighbors<const F extends readonly FieldPath<GlobalMapEventAccountRatingEntry>[] = readonly never[]>(params: {
    accountId: number;
    eventId: string;
    frontId: string;
    limit?: number;
    neighboursCount?: number;
    pageNo?: number;
    fields?: F;
  }): Promise<Selected<GlobalMapEventAccountRatingEntry, F>[]> {
    const query = buildQuery(params);
    query.account_id = String(params.accountId);
    query.event_id = params.eventId;
    query.front_id = params.frontId;
    if (params.neighboursCount !== undefined) query.neighbours_count = String(params.neighboursCount);
    return this.t.wgFetch<Selected<GlobalMapEventAccountRatingEntry, F>[]>(
      this.region,
      "/wot/globalmap/eventaccountratingneighbors/",
      query,
    );
  }

  /** `/wot/globalmap/eventrating/` — clan leaderboard for an event Front. */
  async eventrating<const F extends readonly FieldPath<GlobalMapEventRatingEntry>[] = readonly never[]>(params: {
    eventId: string;
    frontId: string;
    limit?: number;
    pageNo?: number;
    fields?: F;
  }): Promise<Selected<GlobalMapEventRatingEntry, F>[]> {
    const query = buildQuery(params);
    query.event_id = params.eventId;
    query.front_id = params.frontId;
    return this.t.wgFetch<Selected<GlobalMapEventRatingEntry, F>[]>(
      this.region,
      "/wot/globalmap/eventrating/",
      query,
    );
  }

  /** `/wot/globalmap/eventratingneighbors/` — clans adjacent to one in an event rating. */
  async eventratingneighbors<const F extends readonly FieldPath<GlobalMapEventRatingEntry>[] = readonly never[]>(params: {
    clanId: number;
    eventId: string;
    frontId: string;
    limit?: number;
    fields?: F;
  }): Promise<Selected<GlobalMapEventRatingEntry, F>[]> {
    const query = buildQuery(params);
    query.clan_id = String(params.clanId);
    query.event_id = params.eventId;
    query.front_id = params.frontId;
    return this.t.wgFetch<Selected<GlobalMapEventRatingEntry, F>[]>(
      this.region,
      "/wot/globalmap/eventratingneighbors/",
      query,
    );
  }
}
