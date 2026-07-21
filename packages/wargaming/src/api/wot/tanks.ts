import { Region } from "../../region";
import { type Transport, WargamingApiError } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";

/** Extra stat sections `/wot/tanks/stats/` can add to the response (`extra`). */
export enum TankStatsExtra {
  Epic = "epic",
  Fallout = "fallout",
  Random = "random",
  Ranked10x10 = "ranked_10x10",
  RankedBattles = "ranked_battles",
}

/**
 * A per-vehicle statistics block. The fields shared by every battle-mode
 * section are always present; the rest appear only in the sections that
 * report them (e.g. `avg_damage_*` in `all`/`globalmap`, `max_*` in the mode
 * sections, the `avatar_*`/`flag_*` set only in `fallout`).
 */
export type TankStatistics = {
  battle_avg_xp: number;
  battles: number;
  battles_on_stunning_vehicles: number;
  capture_points: number;
  damage_dealt: number;
  damage_received: number;
  draws: number;
  dropped_capture_points: number;
  frags: number;
  hits: number;
  hits_percents: number;
  losses: number;
  radio_assisted_damage: number;
  shots: number;
  spotted: number;
  stun_assisted_damage: number;
  stun_number: number;
  survived_battles: number;
  track_assisted_damage: number;
  wins: number;
  xp: number;
  avg_damage_assisted?: number;
  avg_damage_assisted_radio?: number;
  avg_damage_assisted_stun?: number;
  avg_damage_assisted_track?: number;
  avg_damage_blocked?: number;
  direct_hits_received?: number;
  explosion_hits?: number;
  explosion_hits_received?: number;
  no_damage_direct_hits_received?: number;
  piercings?: number;
  piercings_received?: number;
  tanking_factor?: number;
  max_damage?: number;
  max_frags?: number;
  max_xp?: number;
  avatar_damage_dealt?: number;
  avatar_frags?: number;
  death_count?: number;
  flag_capture?: number;
  flag_capture_solo?: number;
  max_damage_with_avatar?: number;
  max_frags_with_avatar?: number;
  max_win_points?: number;
  resource_absorbed?: number;
  win_points?: number;
};

/** The stat sections of a vehicle. `all` is always present; the rest depend on data/`extra`. */
export type TankStatisticsSet = {
  all: TankStatistics;
  clan?: TankStatistics;
  company?: TankStatistics;
  epic?: TankStatistics;
  fallout?: TankStatistics;
  globalmap?: TankStatistics;
  random?: TankStatistics;
  ranked_10x10?: TankStatistics;
  ranked_battles?: TankStatistics;
  regular_team?: TankStatistics;
  stronghold_defense?: TankStatistics;
  stronghold_skirmish?: TankStatistics;
  team?: TankStatistics;
};

/** `/wot/tanks/stats/` — one vehicle's stats for a player. */
export type TankStats = TankStatisticsSet & {
  account_id: number;
  mark_of_mastery: number;
  max_frags: number;
  max_xp: number;
  tank_id: number;
  /** Destroyed-vehicle tallies. Requires a valid `access_token`. */
  frags: Record<string, number> | null;
  /** Whether the vehicle is in the Garage. Requires a valid `access_token`. */
  in_garage: boolean | null;
};

/** `/wot/tanks/achievements/` — a vehicle's earned achievements for a player. */
export type TankAchievements = {
  account_id: number;
  /** Achievement id → value (mastery class 1-4, series max, section counts). */
  achievements: Record<string, number>;
  max_series: Record<string, number>;
  series: Record<string, number>;
  tank_id: number;
};

/** Distribution basis for `/wot/tanks/mastery/` (`distribution`). */
export enum TankMasteryDistribution {
  Damage = "damage",
  Xp = "xp",
}

/** `/wot/tanks/mastery/` — playerbase percentile distribution per vehicle. */
export type TankMastery = {
  /** Vehicle id → requested percentile → value. */
  distribution: Record<string, Record<string, number>>;
  updated_at: number;
};

/** `/wot/tanks/*` — per-vehicle statistics, achievements, and mastery distribution. */
export class TanksResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** Per-tank stats for one account. */
  async stats<const F extends readonly FieldPath<TankStats>[] = readonly never[]>(params: {
    accountId: number;
    /** Limit to these vehicle ids (WG caps at 100). */
    tankId?: readonly number[];
    /** Extra stat sections to add. */
    extra?: readonly TankStatsExtra[];
    /** Filter by Garage availability (needs `access_token`). */
    inGarage?: boolean;
    /** Response fields to keep — narrows the return type accordingly. */
    fields?: F;
    accessToken?: string;
    language?: WgLanguage;
  }): Promise<Selected<TankStats, F>[]> {
    const query = this.#query(params);
    query.account_id = String(params.accountId);
    const data = await this.t.wgFetch<Record<string, Selected<TankStats, F>[] | null>>(
      this.region,
      "/wot/tanks/stats/",
      query,
    );
    return data[String(params.accountId)] ?? [];
  }

  /**
   * Per-tank stats for many accounts. `/wot/tanks/stats/` is a SINGLE-account
   * endpoint: unlike `account/info`, its `account_id` is not a list, so a
   * comma-joined value comes back as INVALID_ACCOUNT_ID for the whole call.
   * This therefore fans out one request per account concurrently rather than
   * batching. The transport's per-region rate limiter throttles the fan-out to
   * the region's RPS, so N accounts cost N requests (the true floor for a
   * per-account endpoint) instead of ~2N with bisection to isolate a value WG
   * was never going to accept. An unknown/purged account is skipped (empty); a
   * genuine error rejects that one request only.
   */
  async statsBatch<const F extends readonly FieldPath<TankStats>[] = readonly never[]>(params: {
    accountIds: number[];
    tankId?: readonly number[];
    extra?: readonly TankStatsExtra[];
    inGarage?: boolean;
    fields?: F;
    accessToken?: string;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<TankStats, F>[]>> {
    const out = new Map<number, Selected<TankStats, F>[]>();
    const unique = Array.from(new Set(params.accountIds));
    const query = this.#query(params);
    const results = await Promise.allSettled(
      unique.map((id) => this.#one("/wot/tanks/stats/", id, out, query)),
    );
    for (const res of results) {
      if (res.status === "rejected") {
        console.error("[tanks.statsBatch] request failed:", res.reason);
      }
    }
    return out;
  }

  /** Per-tank achievements for one account (`/wot/tanks/achievements/`). */
  async achievements<const F extends readonly FieldPath<TankAchievements>[] = readonly never[]>(params: {
    accountId: number;
    tankId?: readonly number[];
    inGarage?: boolean;
    fields?: F;
    accessToken?: string;
    language?: WgLanguage;
  }): Promise<Selected<TankAchievements, F>[]> {
    const query = this.#query(params);
    query.account_id = String(params.accountId);
    const data = await this.t.wgFetch<Record<string, Selected<TankAchievements, F>[] | null>>(
      this.region,
      "/wot/tanks/achievements/",
      query,
    );
    return data[String(params.accountId)] ?? [];
  }

  /**
   * Per-tank achievements for many accounts. Like `statsBatch`,
   * `/wot/tanks/achievements/` is single-account, so this fans out one
   * rate-limited request per account rather than batching.
   */
  async achievementsBatch<const F extends readonly FieldPath<TankAchievements>[] = readonly never[]>(params: {
    accountIds: number[];
    tankId?: readonly number[];
    inGarage?: boolean;
    fields?: F;
    accessToken?: string;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<TankAchievements, F>[]>> {
    const out = new Map<number, Selected<TankAchievements, F>[]>();
    const unique = Array.from(new Set(params.accountIds));
    const query = this.#query(params);
    const results = await Promise.allSettled(
      unique.map((id) => this.#one("/wot/tanks/achievements/", id, out, query)),
    );
    for (const res of results) {
      if (res.status === "rejected") {
        console.error("[tanks.achievementsBatch] request failed:", res.reason);
      }
    }
    return out;
  }

  /**
   * `/wot/tanks/mastery/` — playerbase percentile distribution of average
   * damage or XP per vehicle (not account-specific).
   */
  async mastery<const F extends readonly FieldPath<TankMastery>[] = readonly never[]>(params: {
    distribution: TankMasteryDistribution;
    /** Percentiles to include (1-100, WG caps at 10). */
    percentile: readonly number[];
    tankId?: readonly number[];
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<TankMastery, F>> {
    const query = buildQuery(params);
    query.distribution = params.distribution;
    query.percentile = params.percentile.join(",");
    if (params.tankId?.length) query.tank_id = params.tankId.join(",");
    return this.t.wgFetch<Selected<TankMastery, F>>(
      this.region,
      "/wot/tanks/mastery/",
      query,
    );
  }

  #query(params: {
    tankId?: readonly number[];
    extra?: readonly TankStatsExtra[];
    inGarage?: boolean;
    fields?: readonly string[];
    accessToken?: string;
    language?: WgLanguage;
  }): Record<string, string> {
    const query = buildQuery(params);
    if (params.tankId?.length) query.tank_id = params.tankId.join(",");
    if (params.inGarage !== undefined) query.in_garage = params.inGarage ? "1" : "0";
    return query;
  }

  /**
   * Fetch one account's per-vehicle rows and merge into `out`. The `/wot/tanks/*`
   * per-vehicle endpoints are single-account, so callers fan this out. An
   * unknown/purged account (INVALID_ACCOUNT_ID) is skipped rather than failing
   * the whole fan-out; any other error propagates.
   */
  async #one<R>(
    path: string,
    id: number,
    out: Map<number, R[]>,
    query: Record<string, string>,
  ): Promise<void> {
    try {
      const data = await this.t.wgFetch<Record<string, R[] | null>>(this.region, path, {
        ...query,
        account_id: String(id),
      });
      for (const [key, tanks] of Object.entries(data)) {
        out.set(Number(key), tanks ?? []);
      }
    } catch (err) {
      if (err instanceof WargamingApiError && err.code === "INVALID_ACCOUNT_ID") return;
      throw err;
    }
  }
}
