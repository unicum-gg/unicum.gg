import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";
import { chunkArray } from "../../util";

/** Sort order for `clans/list` (`order_by`). */
export enum ClanListOrder {
  Name = "name",
  NameDesc = "-name",
  MembersCount = "members_count",
  MembersCountDesc = "-members_count",
  CreatedAt = "created_at",
  CreatedAtDesc = "-created_at",
}

/** Extra blocks `clans/info` can add (`extra`). */
export enum ClanInfoExtra {
  PrivateOnlineMembers = "private.online_members",
}

/** Changes the `members` field shape of `clans/info` (`members_key`). */
export enum ClanInfoMembersKey {
  /** `members` becomes an object keyed by `account_id`. */
  Id = "id",
}

/** Clan emblem links by size (each size → `{ portal, wot }` URLs). */
export type ClanEmblems = Record<string, { portal?: string; wot?: string }> | null;

/** `/wot/clans/list/` — a clan search result. */
export type ClanListItem = {
  clan_id: number;
  color: string;
  created_at: number;
  members_count: number;
  name: string;
  tag: string;
  emblems: ClanEmblems;
};

/** A member row inside `clans/info`. */
export type ClanInfoMember = {
  account_id: number;
  account_name: string;
  joined_at: number;
  role: string;
  role_i18n: string;
};

/** Restricted `clans/info` treasury data (needs `access_token`). */
export type ClanTreasury = { credits: number; crystal: number; gold: number };

/** Restricted `clans/info` block (needs `access_token` / `extra`). */
export type ClanPrivateInfo = {
  online_members: number[];
  treasury: number;
  clan_treasury: ClanTreasury;
};

/** `/wot/clans/info/` — full clan details. */
export type ClanInfo = {
  accepts_join_requests: boolean;
  clan_id: number;
  color: string;
  created_at: number;
  creator_id: number;
  creator_name: string;
  description: string;
  description_html: string;
  is_clan_disbanded: boolean;
  leader_id: number;
  leader_name: string;
  members_count: number;
  motto: string;
  name: string;
  old_name: string;
  old_tag: string;
  renamed_at: number;
  tag: string;
  updated_at: number;
  emblems: ClanEmblems;
  /** Default shape; becomes an object keyed by `account_id` with `members_key: id`. */
  members: ClanInfoMember[];
  private: ClanPrivateInfo | null;
};

/** Short clan info embedded in `clans/accountinfo`. */
export type ClanShortInfo = {
  clan_id: number;
  color: string;
  created_at: number;
  members_count: number;
  name: string;
  tag: string;
  emblems: ClanEmblems;
};

/** `/wot/clans/accountinfo/` — a player's clan membership. */
export type ClanAccountInfo = {
  account_id: number;
  account_name: string;
  joined_at: number;
  role: string;
  role_i18n: string;
  clan: ClanShortInfo | null;
};

/** `/wot/clans/glossary/` — clan entity dictionaries. */
export type ClanGlossary = { clans_roles: Record<string, string> };

/** `/wot/clans/memberhistory/` — one past/current clan membership. */
export type ClanMemberHistoryEntry = {
  account_id: number;
  clan_id: number;
  joined_at: number;
  left_at: number;
  role: string;
};

/** `/wot/clans/messageboard/` — a clan message-board post (needs `access_token`). */
export type ClanMessageBoardPost = {
  author_id: number;
  created_at: number;
  editor_id: number;
  is_read: boolean;
  message: string;
  updated_at: number;
};

/** WG caps `clans/info` and `clans/accountinfo` at 100 ids per request. */
const CLAN_BATCH_SIZE = 100;

/** `/wot/clans/*` — clan search, details, membership and history. */
export class ApiClansResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** `/wot/clans/list/` — search/sort clans (one page). */
  async list<const F extends readonly FieldPath<ClanListItem>[] = readonly never[]>(params: {
    search?: string;
    orderBy?: ClanListOrder;
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Selected<ClanListItem, F>[]> {
    const query = buildQuery(params);
    if (params.search) query.search = params.search;
    return this.t.wgFetch<Selected<ClanListItem, F>[]>(
      this.region,
      "/wot/clans/list/",
      query,
    );
  }

  /** `/wot/clans/info/` — full details for one clan. */
  async info<const F extends readonly FieldPath<ClanInfo>[] = readonly never[]>(params: {
    clanId: number;
    extra?: readonly ClanInfoExtra[];
    membersKey?: ClanInfoMembersKey;
    accessToken?: string;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<ClanInfo, F> | null> {
    const query = this.#infoQuery(params);
    query.clan_id = String(params.clanId);
    const data = await this.t.wgFetch<Record<string, Selected<ClanInfo, F> | null>>(
      this.region,
      "/wot/clans/info/",
      query,
    );
    return data[String(params.clanId)] ?? null;
  }

  /** Batched `clans/info` (WG caps a request at 100 clan ids). */
  async infoBatch<const F extends readonly FieldPath<ClanInfo>[] = readonly never[]>(params: {
    clanIds: number[];
    extra?: readonly ClanInfoExtra[];
    accessToken?: string;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<ClanInfo, F>>> {
    const query = this.#infoQuery(params);
    return this.#keyedBatch("/wot/clans/info/", "clan_id", params.clanIds, query);
  }

  #infoQuery(params: {
    extra?: readonly ClanInfoExtra[];
    membersKey?: ClanInfoMembersKey;
    accessToken?: string;
    fields?: readonly string[];
    language?: WgLanguage;
  }): Record<string, string> {
    const query = buildQuery(params);
    if (params.membersKey) query.members_key = params.membersKey;
    return query;
  }

  /** `/wot/clans/accountinfo/` — one player's clan membership. */
  async accountinfo<const F extends readonly FieldPath<ClanAccountInfo>[] = readonly never[]>(params: {
    accountId: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<ClanAccountInfo, F> | null> {
    const query = buildQuery(params);
    query.account_id = String(params.accountId);
    const data = await this.t.wgFetch<Record<string, Selected<ClanAccountInfo, F> | null>>(
      this.region,
      "/wot/clans/accountinfo/",
      query,
    );
    return data[String(params.accountId)] ?? null;
  }

  /** Batched `clans/accountinfo` (WG caps a request at 100 account ids). */
  async accountinfoBatch<const F extends readonly FieldPath<ClanAccountInfo>[] = readonly never[]>(params: {
    accountIds: number[];
    fields?: F;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<ClanAccountInfo, F>>> {
    return this.#keyedBatch(
      "/wot/clans/accountinfo/",
      "account_id",
      params.accountIds,
      buildQuery(params),
    );
  }

  /** `/wot/clans/glossary/` — clan entity dictionaries (roles). */
  async glossary<const F extends readonly FieldPath<ClanGlossary>[] = readonly never[]>(
    params: { fields?: F; language?: WgLanguage } = {},
  ): Promise<Selected<ClanGlossary, F>> {
    return this.t.wgFetch<Selected<ClanGlossary, F>>(
      this.region,
      "/wot/clans/glossary/",
      buildQuery(params),
    );
  }

  /** `/wot/clans/memberhistory/` — a player's last 10 clan memberships. */
  async memberhistory<const F extends readonly FieldPath<ClanMemberHistoryEntry>[] = readonly never[]>(params: {
    accountId: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<ClanMemberHistoryEntry, F>[]> {
    const query = buildQuery(params);
    query.account_id = String(params.accountId);
    const data = await this.t.wgFetch<Record<string, Selected<ClanMemberHistoryEntry, F>[] | null>>(
      this.region,
      "/wot/clans/memberhistory/",
      query,
    );
    return data[String(params.accountId)] ?? [];
  }

  /**
   * `/wot/clans/messageboard/` — the caller's clan message board (needs
   * `access_token`). WG labels this method deprecated, but it stays live.
   */
  async messageboard<const F extends readonly FieldPath<ClanMessageBoardPost>[] = readonly never[]>(params: {
    accessToken: string;
    fields?: F;
  }): Promise<Selected<ClanMessageBoardPost, F>[]> {
    return this.t.wgFetch<Selected<ClanMessageBoardPost, F>[]>(
      this.region,
      "/wot/clans/messageboard/",
      buildQuery(params),
    );
  }

  /** Chunk a batched id-keyed endpoint and merge the non-null entries into a Map. */
  async #keyedBatch<R>(
    path: string,
    idKey: string,
    ids: number[],
    query: Record<string, string>,
  ): Promise<Map<number, R>> {
    const out = new Map<number, R>();
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return out;
    const results = await Promise.allSettled(
      chunkArray(unique, CLAN_BATCH_SIZE).map((batch) =>
        this.t.wgFetch<Record<string, R | null>>(this.region, path, {
          ...query,
          [idKey]: batch.join(","),
        }),
      ),
    );
    for (const res of results) {
      if (res.status === "rejected") {
        console.error(`[clans ${path}] chunk failed:`, res.reason);
        continue;
      }
      for (const [id, value] of Object.entries(res.value)) {
        if (value != null) out.set(Number(id), value);
      }
    }
    return out;
  }
}
