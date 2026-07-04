import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";

/** A rating category, for the `rank_field` param of `neighbors`/`top`. */
export enum ClanRatingField {
  BattlesCountAvg = "battles_count_avg",
  BattlesCountAvgDaily = "battles_count_avg_daily",
  Efficiency = "efficiency",
  FortEloRating = "fb_elo_rating",
  FortEloRating10 = "fb_elo_rating_10",
  FortEloRating6 = "fb_elo_rating_6",
  FortEloRating8 = "fb_elo_rating_8",
  GlobalRatingAvg = "global_rating_avg",
  GlobalRatingWeightedAvg = "global_rating_weighted_avg",
  GlobalMapEloRating = "gm_elo_rating",
  GlobalMapEloRating10 = "gm_elo_rating_10",
  GlobalMapEloRating6 = "gm_elo_rating_6",
  GlobalMapEloRating8 = "gm_elo_rating_8",
  RatingFort = "rating_fort",
  Vehicles10Avg = "v10l_avg",
  WinsRatioAvg = "wins_ratio_avg",
}

/** `/wot/clanratings/types/` — a rating period and its categories. */
export type ClanRatingType = {
  rank_fields: string[];
  type: string;
};

/** `/wot/clanratings/dates/` — the dates that have rating data. */
export type ClanRatingDates = {
  dates: number[];
};

/** One rating category's value for a clan: absolute value plus leaderboard rank. */
export type ClanRatingValue = {
  rank: number;
  rank_delta: number;
  value: number;
};

/** A clan row across every rating category (`clans`/`neighbors`/`top`). */
export type ClanRatingClan = {
  clan_id: number;
  clan_name: string;
  clan_tag: string;
  /**
   * Category name → reason it was not calculated (`inactivity`,
   * `newbies_measure`, `limits`, `blocked`, `other`).
   */
  exclude_reasons: Record<string, string>;
  battles_count_avg: ClanRatingValue;
  battles_count_avg_daily: ClanRatingValue;
  efficiency: ClanRatingValue;
  fb_elo_rating: ClanRatingValue;
  fb_elo_rating_10: ClanRatingValue;
  fb_elo_rating_6: ClanRatingValue;
  fb_elo_rating_8: ClanRatingValue;
  global_rating_avg: ClanRatingValue;
  global_rating_weighted_avg: ClanRatingValue;
  gm_elo_rating: ClanRatingValue;
  gm_elo_rating_10: ClanRatingValue;
  gm_elo_rating_6: ClanRatingValue;
  gm_elo_rating_8: ClanRatingValue;
  rating_fort: ClanRatingValue;
  v10l_avg: ClanRatingValue;
  wins_ratio_avg: ClanRatingValue;
};

/** WG caps `clanratings/clans` at 100 clan ids per request. */
const CLAN_RATINGS_BATCH_SIZE = 100;

/** `/wot/clanratings/*` — clan leaderboards across the WG rating categories. */
export class ClanRatingsResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** `/wot/clanratings/types/` — the rating periods and their categories. */
  async types(): Promise<Record<string, ClanRatingType>> {
    return this.t.wgFetch<Record<string, ClanRatingType>>(
      this.region,
      "/wot/clanratings/types/",
      {},
    );
  }

  /** `/wot/clanratings/dates/` — dates with available rating data. */
  async dates(params: { limit?: number } = {}): Promise<ClanRatingDates> {
    return this.t.wgFetch<ClanRatingDates>(
      this.region,
      "/wot/clanratings/dates/",
      buildQuery(params),
    );
  }

  /** `/wot/clanratings/clans/` — ratings for one clan. */
  async clans<const F extends readonly FieldPath<ClanRatingClan>[] = readonly never[]>(params: {
    clanId: number;
    date?: string | number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<ClanRatingClan, F> | null> {
    const query = this.#query(params);
    query.clan_id = String(params.clanId);
    const data = await this.t.wgFetch<Record<string, Selected<ClanRatingClan, F> | null>>(
      this.region,
      "/wot/clanratings/clans/",
      query,
    );
    return data[String(params.clanId)] ?? null;
  }

  /** Batched `clans` (WG caps a request at 100 clan ids). */
  async clansBatch<const F extends readonly FieldPath<ClanRatingClan>[] = readonly never[]>(params: {
    clanIds: number[];
    date?: string | number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<ClanRatingClan, F>>> {
    const out = new Map<number, Selected<ClanRatingClan, F>>();
    const unique = Array.from(new Set(params.clanIds));
    const query = this.#query(params);
    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += CLAN_RATINGS_BATCH_SIZE) {
      chunks.push(unique.slice(i, i + CLAN_RATINGS_BATCH_SIZE));
    }
    await Promise.all(
      chunks.map(async (batch) => {
        const data = await this.t.wgFetch<Record<string, Selected<ClanRatingClan, F> | null>>(
          this.region,
          "/wot/clanratings/clans/",
          { ...query, clan_id: batch.join(",") },
        );
        for (const [id, value] of Object.entries(data)) {
          if (value != null) out.set(Number(id), value);
        }
      }),
    );
    return out;
  }

  /** `/wot/clanratings/neighbors/` — clans adjacent to one in a category. */
  async neighbors<const F extends readonly FieldPath<ClanRatingClan>[] = readonly never[]>(params: {
    clanId: number;
    rankField: ClanRatingField;
    date?: string | number;
    limit?: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<ClanRatingClan, F>[]> {
    const query = this.#query(params);
    query.clan_id = String(params.clanId);
    query.rank_field = params.rankField;
    return this.t.wgFetch<Selected<ClanRatingClan, F>[]>(
      this.region,
      "/wot/clanratings/neighbors/",
      query,
    );
  }

  /** `/wot/clanratings/top/` — the top clans in a category. */
  async top<const F extends readonly FieldPath<ClanRatingClan>[] = readonly never[]>(params: {
    rankField: ClanRatingField;
    date?: string | number;
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<ClanRatingClan, F>[]> {
    const query = this.#query(params);
    query.rank_field = params.rankField;
    return this.t.wgFetch<Selected<ClanRatingClan, F>[]>(
      this.region,
      "/wot/clanratings/top/",
      query,
    );
  }

  #query(params: {
    date?: string | number;
    limit?: number;
    pageNo?: number;
    fields?: readonly string[];
    language?: WgLanguage;
  }): Record<string, string> {
    const query = buildQuery(params);
    if (params.date !== undefined) query.date = String(params.date);
    return query;
  }
}
