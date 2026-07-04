import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";
import { chunkArray } from "../../util";
import type { ClanEmblems } from "../wot/clans";

// WGN cross-game clan endpoints. WG labels `membersinfo` deprecated (it points
// to the WoT `clans/accountinfo`), but it has stayed live for years; kept here
// and only to be removed if WG actually drops it.

/** Game to search clans in, for WGN clan methods (`game`). */
export enum WgnClansGame {
  WorldOfTanks = "wot",
  WorldOfWarplanes = "wowp",
}

/** Short clan info embedded in the WGN `membersinfo` response. */
export type WgnMemberClan = {
  clan_id: number;
  color: string;
  created_at: number;
  game: string;
  members_count: number;
  name: string;
  tag: string;
  emblems: ClanEmblems;
};

/** `/wgn/clans/membersinfo/` — a player's clan membership (cross-game). */
export type WgnClanMemberInfo = {
  account_id: number;
  account_name: string;
  joined_at: number;
  role: string;
  role_i18n: string;
  clan: WgnMemberClan | null;
};

/** WG caps `clans/membersinfo` at 100 account ids per request. */
const MEMBERS_INFO_BATCH_SIZE = 100;

/** `/wgn/clans/*` — WGN cross-game clan data. */
export class WgnClansResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** `/wgn/clans/membersinfo/` — one player's clan membership. */
  async membersInfo<const F extends readonly FieldPath<WgnClanMemberInfo>[] = readonly never[]>(params: {
    accountId: number;
    game?: WgnClansGame;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<WgnClanMemberInfo, F> | null> {
    const query = this.#query(params);
    query.account_id = String(params.accountId);
    const data = await this.t.wgFetch<Record<string, Selected<WgnClanMemberInfo, F> | null>>(
      this.region,
      "/wgn/clans/membersinfo/",
      query,
    );
    return data[String(params.accountId)] ?? null;
  }

  /** Batched `membersinfo` (WG caps a request at 100 account ids). */
  async membersInfoBatch<const F extends readonly FieldPath<WgnClanMemberInfo>[] = readonly never[]>(params: {
    accountIds: number[];
    game?: WgnClansGame;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Map<number, Selected<WgnClanMemberInfo, F>>> {
    const out = new Map<number, Selected<WgnClanMemberInfo, F>>();
    const unique = Array.from(new Set(params.accountIds));
    if (unique.length === 0) return out;
    const query = this.#query(params);
    const results = await Promise.allSettled(
      chunkArray(unique, MEMBERS_INFO_BATCH_SIZE).map((batch) =>
        this.t.wgFetch<Record<string, Selected<WgnClanMemberInfo, F> | null>>(
          this.region,
          "/wgn/clans/membersinfo/",
          { ...query, account_id: batch.join(",") },
        ),
      ),
    );
    for (const res of results) {
      if (res.status === "rejected") {
        console.error("[wgnClans.membersInfoBatch] chunk failed:", res.reason);
        continue;
      }
      for (const [id, value] of Object.entries(res.value)) {
        if (value != null) out.set(Number(id), value);
      }
    }
    return out;
  }

  #query(params: {
    game?: WgnClansGame;
    fields?: readonly string[];
    language?: WgLanguage;
  }): Record<string, string> {
    const query = buildQuery(params);
    if (params.game) query.game = params.game;
    return query;
  }
}
