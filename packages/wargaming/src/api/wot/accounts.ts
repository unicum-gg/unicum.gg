import { Region } from "../../region";
import { type Transport, WargamingApiError } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";

export enum AccountListSearchType {
  StartsWith = "startswith",
  Exact = "exact",
}

/** Extra stat blocks that `/wot/account/info/` can add to the response. */
export enum AccountInfoExtra {
  Epic = "statistics.epic",
  Fallout = "statistics.fallout",
  GlobalMapAbsolute = "statistics.globalmap_absolute",
  GlobalMapChampion = "statistics.globalmap_champion",
  GlobalMapMiddle = "statistics.globalmap_middle",
  RankedBattles = "statistics.ranked_battles",
  StrongholdSkirmish = "statistics.stronghold_skirmish",
  StrongholdDefense = "statistics.stronghold_defense",
}

export type PlayerSearchResult = {
  account_id: number;
  nickname: string;
};

/** A statistics block (shape shared by every `statistics.*` section). */
export type PlayerStatistics = {
  avg_damage_assisted: number;
  avg_damage_assisted_radio: number;
  avg_damage_assisted_stun: number;
  avg_damage_assisted_track: number;
  avg_damage_blocked: number;
  battle_avg_xp: number;
  battles: number;
  battles_on_stunning_vehicles: number;
  capture_points: number;
  damage_dealt: number;
  damage_received: number;
  direct_hits_received: number;
  draws: number;
  dropped_capture_points: number;
  explosion_hits: number;
  explosion_hits_received: number;
  frags: number;
  hits: number;
  hits_percents: number;
  losses: number;
  max_damage: number;
  max_damage_tank_id: number;
  max_frags: number;
  max_frags_tank_id: number;
  max_xp: number;
  max_xp_tank_id: number;
  no_damage_direct_hits_received: number;
  piercings: number;
  piercings_received: number;
  radio_assisted_damage: number;
  shots: number;
  spotted: number;
  stun_assisted_damage: number;
  stun_number: number;
  survived_battles: number;
  tanking_factor: number;
  track_assisted_damage: number;
  wins: number;
  xp: number;
};

/** Per-mode statistics. `all` is always present; the rest depend on data/`extra`. */
export type PlayerStatisticsSet = {
  frags: Record<string, number>;
  trees_cut: number;
  all: PlayerStatistics;
  clan?: PlayerStatistics;
  company?: PlayerStatistics;
  historical?: PlayerStatistics;
  random?: PlayerStatistics;
  regular_team?: PlayerStatistics;
  team?: PlayerStatistics;
  stronghold_defense?: PlayerStatistics;
  stronghold_skirmish?: PlayerStatistics;
  epic?: PlayerStatistics;
  fallout?: PlayerStatistics;
  globalmap_absolute?: PlayerStatistics;
  globalmap_champion?: PlayerStatistics;
  globalmap_middle?: PlayerStatistics;
  ranked_battles?: PlayerStatistics;
  ranked_battles_current?: PlayerStatistics;
  ranked_battles_previous?: PlayerStatistics;
  ranked_10x10?: PlayerStatistics;
  ranked_15x15?: PlayerStatistics;
  ranked_season_1?: PlayerStatistics;
  ranked_season_2?: PlayerStatistics;
  ranked_season_3?: PlayerStatistics;
};

/** Private account data — only returned with a valid `access_token` (`extra`). */
export type PlayerPrivate = {
  ban_info: string | null;
  ban_time: number | null;
  battle_life_time: number;
  bonds: number;
  credits: number;
  free_xp: number;
  garage: number[];
  gold: number;
  is_bound_to_phone: boolean;
  is_premium: boolean;
  personal_missions: Record<string, string>;
  premium_expires_at: number;
  boosters: Record<string, { count: number; expiration_time: number; state: string }>;
  grouped_contacts: {
    blocked: number[];
    groups: Record<string, unknown>;
    ignored: number[];
    muted: number[];
    ungrouped: number[];
  };
  rented: {
    compensation_credits: number;
    compensation_gold: number;
    expiration_time: number;
    tank_id: number;
  };
  restrictions: { chat_ban_time: number };
};

export type PlayerInfo = {
  account_id: number;
  clan_id: number | null;
  client_language: string;
  created_at: number;
  global_rating: number;
  last_battle_time: number;
  logout_at: number;
  nickname: string;
  updated_at: number;
  private: PlayerPrivate | null;
  statistics: PlayerStatisticsSet;
};

/** A vehicle in the player's account (`/wot/account/tanks/`). */
export type AccountTank = {
  tank_id: number;
  mark_of_mastery: number;
  statistics: { battles: number; wins: number };
};

/** Achievements for an account (`/wot/account/achievements/`). */
export type AccountAchievements = {
  achievements: Record<string, number>;
  frags: Record<string, number>;
  max_series: Record<string, number>;
};

const ACCOUNT_INFO_BATCH_SIZE = 100;
const ACCOUNT_WTR_BATCH_SIZE = 100;

/** `/wot/account/*` — player search, personal data, WTR. */
export class AccountsResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /**
   * `/wot/account/list/` — search players by name. Faithful mapping of the
   * endpoint's parameters (all optional except `search`); `type` defaults to
   * WG's "startswith", `language` to "en".
   */
  async list<
    const F extends readonly FieldPath<PlayerSearchResult>[] = readonly never[],
  >(params: {
    search: string;
    type?: AccountListSearchType;
    limit?: number;
    /** Response fields to keep — narrows the return type accordingly. */
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<PlayerSearchResult, F>[]> {
    const query = buildQuery(params);
    query.search = params.search;
    if (params.type) query.type = params.type;
    try {
      return await this.t.wgFetch<Selected<PlayerSearchResult, F>[]>(
        this.region,
        "/wot/account/list/",
        query,
      );
    } catch (err) {
      if (err instanceof WargamingApiError && err.code === "INVALID_SEARCH") return [];
      throw err;
    }
  }

  /** Personal data for one account (`/wot/account/info/`). */
  async info<const F extends readonly FieldPath<PlayerInfo>[] = readonly never[]>(params: {
    accountId: number;
    /** Response fields to keep — narrows the return type accordingly. */
    fields?: F;
    /** Extra stat blocks to add to the response. */
    extra?: readonly AccountInfoExtra[];
    language?: WgLanguage;
  }): Promise<Selected<PlayerInfo, F> | null> {
    const query = buildQuery(params);
    query.account_id = String(params.accountId);
    const data = await this.t.wgFetch<Record<string, Selected<PlayerInfo, F> | null>>(
      this.region,
      "/wot/account/info/",
      query,
    );
    return data[String(params.accountId)] ?? null;
  }

  /** Batched personal data; chunks + bisects on INVALID_ACCOUNT_ID. */
  async infoBatch<const F extends readonly FieldPath<PlayerInfo>[] = readonly never[]>(params: {
    accountIds: number[];
    fields?: F;
    extra?: readonly AccountInfoExtra[];
    language?: WgLanguage;
  }): Promise<Map<number, Selected<PlayerInfo, F>>> {
    const out = new Map<number, Selected<PlayerInfo, F>>();
    const unique = Array.from(new Set(params.accountIds));
    const query = buildQuery(params);
    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += ACCOUNT_INFO_BATCH_SIZE) {
      chunks.push(unique.slice(i, i + ACCOUNT_INFO_BATCH_SIZE));
    }
    await Promise.all(chunks.map((batch) => this.#batchChunk("/wot/account/info/", batch, out, query)));
    return out;
  }

  /** Fetch one chunk of a batched `account_id` endpoint, bisecting on INVALID_ACCOUNT_ID. */
  async #batchChunk<R>(
    path: string,
    ids: number[],
    out: Map<number, R>,
    query: Record<string, string>,
  ): Promise<void> {
    if (ids.length === 0) return;
    try {
      const data = await this.t.wgFetch<Record<string, R | null>>(
        this.region,
        path,
        { ...query, account_id: ids.join(",") },
      );
      for (const [id, value] of Object.entries(data)) {
        if (value != null) out.set(Number(id), value);
      }
    } catch (err) {
      if (
        err instanceof WargamingApiError &&
        err.code === "INVALID_ACCOUNT_ID" &&
        ids.length > 1
      ) {
        const mid = Math.floor(ids.length / 2);
        await Promise.all([
          this.#batchChunk(path, ids.slice(0, mid), out, query),
          this.#batchChunk(path, ids.slice(mid), out, query),
        ]);
        return;
      }
      if (err instanceof WargamingApiError && err.code === "INVALID_ACCOUNT_ID") return;
      throw err;
    }
  }

  /** `/wot/account/tanks/` — the player's vehicles (id, mastery, basic stats). */
  async vehicles<const F extends readonly FieldPath<AccountTank>[] = readonly never[]>(params: {
    accountId: number;
    fields?: F;
    accessToken?: string;
    language?: WgLanguage;
  }): Promise<Selected<AccountTank, F>[]> {
    const query = buildQuery(params);
    query.account_id = String(params.accountId);
    const data = await this.t.wgFetch<Record<string, Selected<AccountTank, F>[] | null>>(
      this.region,
      "/wot/account/tanks/",
      query,
    );
    return data[String(params.accountId)] ?? [];
  }

  /** Batched player vehicles; chunks + bisects on INVALID_ACCOUNT_ID. */
  async vehiclesBatch<const F extends readonly FieldPath<AccountTank>[] = readonly never[]>(params: {
    accountIds: number[];
    fields?: F;
    accessToken?: string;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<AccountTank, F>[]>> {
    const out = new Map<number, Selected<AccountTank, F>[]>();
    const unique = Array.from(new Set(params.accountIds));
    const query = buildQuery(params);
    for (let i = 0; i < unique.length; i += ACCOUNT_INFO_BATCH_SIZE) {
      await this.#batchChunk("/wot/account/tanks/", unique.slice(i, i + ACCOUNT_INFO_BATCH_SIZE), out, query);
    }
    return out;
  }

  /** `/wot/account/achievements/` — achievements earned + progress. */
  async achievements<const F extends readonly FieldPath<AccountAchievements>[] = readonly never[]>(params: {
    accountId: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<AccountAchievements, F> | null> {
    const query = buildQuery(params);
    query.account_id = String(params.accountId);
    const data = await this.t.wgFetch<Record<string, Selected<AccountAchievements, F> | null>>(
      this.region,
      "/wot/account/achievements/",
      query,
    );
    return data[String(params.accountId)] ?? null;
  }

  /** Batched achievements; chunks + bisects on INVALID_ACCOUNT_ID. */
  async achievementsBatch<
    const F extends readonly FieldPath<AccountAchievements>[] = readonly never[],
  >(params: {
    accountIds: number[];
    fields?: F;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<AccountAchievements, F>>> {
    const out = new Map<number, Selected<AccountAchievements, F>>();
    const unique = Array.from(new Set(params.accountIds));
    const query = buildQuery(params);
    for (let i = 0; i < unique.length; i += ACCOUNT_INFO_BATCH_SIZE) {
      await this.#batchChunk("/wot/account/achievements/", unique.slice(i, i + ACCOUNT_INFO_BATCH_SIZE), out, query);
    }
    return out;
  }

  /** WoT rating (WTR) for one account. */
  async wtr({ accountId }: { accountId: number }): Promise<number | null> {
    const data = await this.t.wgFetch<Record<string, { rating: number } | null>>(
      this.region,
      "/wot/account/wtr/",
      { account_id: String(accountId) },
    );
    return data[String(accountId)]?.rating ?? null;
  }

  /** Batched WTR; chunks + bisects on INVALID_ACCOUNT_ID. */
  async wtrBatch({
    accountIds,
  }: {
    accountIds: number[];
  }): Promise<Map<number, number>> {
    const out = new Map<number, number>();
    const unique = Array.from(new Set(accountIds));
    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += ACCOUNT_WTR_BATCH_SIZE) {
      chunks.push(unique.slice(i, i + ACCOUNT_WTR_BATCH_SIZE));
    }
    await Promise.all(chunks.map((batch) => this.#wtrChunk(batch, out)));
    return out;
  }

  async #wtrChunk(ids: number[], out: Map<number, number>): Promise<void> {
    if (ids.length === 0) return;
    try {
      const data = await this.t.wgFetch<Record<string, { rating: number } | null>>(
        this.region,
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
          this.#wtrChunk(ids.slice(0, mid), out),
          this.#wtrChunk(ids.slice(mid), out),
        ]);
        return;
      }
      if (err instanceof WargamingApiError && err.code === "INVALID_ACCOUNT_ID") return;
      throw err;
    }
  }
}
