import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";
import { chunkArray } from "../../util";

// WG labels the whole `ratings/*` category "deprecated", but it has stayed live
// for years; kept here as normal methods and only to be removed if WG actually
// drops it. For the current Personal Rating, see `accounts.wtr`.

/** Battle mode for the player-ratings methods (`battle_type`). */
export enum RatingBattleType {
  Company = "company",
  Random = "random",
  Team = "team",
  Default = "default",
}

/** A rating category, for the `rank_field` param of `neighbors`/`top`. */
export enum PlayerRatingField {
  BattlesCount = "battles_count",
  CapturePoints = "capture_points",
  DamageAvg = "damage_avg",
  DamageDealt = "damage_dealt",
  FragsAvg = "frags_avg",
  FragsCount = "frags_count",
  GlobalRating = "global_rating",
  HitsRatio = "hits_ratio",
  SpottedAvg = "spotted_avg",
  SpottedCount = "spotted_count",
  SurvivedRatio = "survived_ratio",
  WinsRatio = "wins_ratio",
  XpAmount = "xp_amount",
  XpAvg = "xp_avg",
  XpMax = "xp_max",
}

/** `/wot/ratings/types/` — a rating period and its categories. */
export type PlayerRatingType = {
  rank_fields: string[];
  threshold: number;
  type: string;
};

/** `/wot/ratings/dates/` — dates with available rating data. */
export type PlayerRatingDates = { dates: number[] };

/** One rating category's value: absolute value plus leaderboard rank. */
export type RatingValue = {
  rank: number;
  rank_delta: number;
  value: number;
};

/** A player row across every rating category (`accounts`/`neighbors`/`top`). */
export type PlayerRating = {
  account_id: number;
  battles_to_play: number;
  battles_count: RatingValue;
  capture_points: RatingValue;
  damage_avg: RatingValue;
  damage_dealt: RatingValue;
  frags_avg: RatingValue;
  frags_count: RatingValue;
  global_rating: RatingValue;
  hits_ratio: RatingValue;
  spotted_avg: RatingValue;
  spotted_count: RatingValue;
  survived_ratio: RatingValue;
  wins_ratio: RatingValue;
  xp_amount: RatingValue;
  xp_avg: RatingValue;
  xp_max: RatingValue;
};

/** WG caps `ratings/accounts` at 100 account ids per request. */
const RATINGS_BATCH_SIZE = 100;

/**
 * `/wot/ratings/*` — the legacy per-period player rating leaderboards. WG marks
 * the category deprecated, but it still responds; superseded by `accounts.wtr`.
 */
export class RatingsResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** `/wot/ratings/types/` — the rating periods and their categories. */
  async types(params: { battleType?: RatingBattleType } = {}): Promise<Record<string, PlayerRatingType>> {
    const query: Record<string, string> = {};
    if (params.battleType) query.battle_type = params.battleType;
    return this.t.wgFetch<Record<string, PlayerRatingType>>(
      this.region,
      "/wot/ratings/types/",
      query,
    );
  }

  /** `/wot/ratings/dates/` — dates with available rating data for a period. */
  async dates(params: {
    type: string;
    accountId?: readonly number[];
    battleType?: RatingBattleType;
    fields?: readonly string[];
    language?: WgLanguage;
  }): Promise<PlayerRatingDates> {
    const query = this.#query(params);
    if (params.accountId?.length) query.account_id = params.accountId.join(",");
    return this.t.wgFetch<PlayerRatingDates>(this.region, "/wot/ratings/dates/", query);
  }

  /** `/wot/ratings/accounts/` — ratings for one account. */
  async accounts<const F extends readonly FieldPath<PlayerRating>[] = readonly never[]>(params: {
    accountId: number;
    type: string;
    battleType?: RatingBattleType;
    date?: string | number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<PlayerRating, F> | null> {
    const query = this.#query(params);
    query.account_id = String(params.accountId);
    const data = await this.t.wgFetch<Record<string, Selected<PlayerRating, F> | null>>(
      this.region,
      "/wot/ratings/accounts/",
      query,
    );
    return data[String(params.accountId)] ?? null;
  }

  /** Batched `ratings/accounts` (WG caps a request at 100 account ids). */
  async accountsBatch<const F extends readonly FieldPath<PlayerRating>[] = readonly never[]>(params: {
    accountIds: number[];
    type: string;
    battleType?: RatingBattleType;
    date?: string | number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<PlayerRating, F>>> {
    const out = new Map<number, Selected<PlayerRating, F>>();
    const unique = Array.from(new Set(params.accountIds));
    if (unique.length === 0) return out;
    const query = this.#query(params);
    const results = await Promise.allSettled(
      chunkArray(unique, RATINGS_BATCH_SIZE).map((batch) =>
        this.t.wgFetch<Record<string, Selected<PlayerRating, F> | null>>(
          this.region,
          "/wot/ratings/accounts/",
          { ...query, account_id: batch.join(",") },
        ),
      ),
    );
    for (const res of results) {
      if (res.status === "rejected") {
        console.error("[ratings.accountsBatch] chunk failed:", res.reason);
        continue;
      }
      for (const [id, value] of Object.entries(res.value)) {
        if (value != null) out.set(Number(id), value);
      }
    }
    return out;
  }

  /** `/wot/ratings/neighbors/` — players adjacent to one in a category. */
  async neighbors<const F extends readonly FieldPath<PlayerRating>[] = readonly never[]>(params: {
    accountId: number;
    rankField: PlayerRatingField;
    type: string;
    battleType?: RatingBattleType;
    date?: string | number;
    limit?: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<PlayerRating, F>[]> {
    const query = this.#query(params);
    query.account_id = String(params.accountId);
    query.rank_field = params.rankField;
    return this.t.wgFetch<Selected<PlayerRating, F>[]>(
      this.region,
      "/wot/ratings/neighbors/",
      query,
    );
  }

  /** `/wot/ratings/top/` — the top players in a category. */
  async top<const F extends readonly FieldPath<PlayerRating>[] = readonly never[]>(params: {
    rankField: PlayerRatingField;
    type: string;
    battleType?: RatingBattleType;
    date?: string | number;
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<PlayerRating, F>[]> {
    const query = this.#query(params);
    query.rank_field = params.rankField;
    return this.t.wgFetch<Selected<PlayerRating, F>[]>(
      this.region,
      "/wot/ratings/top/",
      query,
    );
  }

  #query(params: {
    type: string;
    battleType?: RatingBattleType;
    date?: string | number;
    limit?: number;
    pageNo?: number;
    fields?: readonly string[];
    language?: WgLanguage;
  }): Record<string, string> {
    const query = buildQuery(params);
    query.type = params.type;
    if (params.battleType) query.battle_type = params.battleType;
    if (params.date !== undefined) query.date = String(params.date);
    return query;
  }
}
