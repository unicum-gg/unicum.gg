import { Region, REGION_PORTAL_HOST } from "../../region";
import type { Transport } from "../../client/transport";
import { ClanRole, ClanEventType } from "./clan-enums";

export { ClanRole, ClanEventType } from "./clan-enums";

export type ClanMemberPeriodStats = {
  battles: number;
  winsPercentage: number;
  damagePerBattle: number;
  expPerBattle: number;
  fragsPerBattle: number;
  battlesPerDay: number;
};

/** Raw clan member from the portal — no ratings (those are the app's WNX). */
export type PortalClanMember = {
  accountId: number;
  name: string;
  role: ClanRole;
  roleLocalized: string;
  roleRank: number;
  daysInClan: number;
  lastBattleTime: Date | null;
  personalRating: number | null;
  overall: ClanMemberPeriodStats | null;
  d28: ClanMemberPeriodStats | null;
};

/** Raw clan profile payload from the portal `claninfo` endpoint. */
export type PortalClanProfile = {
  clanview?: { profiles?: Array<{ type?: string; languages_list?: string[] }> };
};

export type ClanRecentEvent = {
  type: ClanEventType;
  createdAt: Date;
  accountId: number;
  accountName: string;
  oldRole: string | null;
  newRole: string | null;
  oldRank: number | null;
  newRank: number | null;
};

type PortalMemberRaw = {
  id: number;
  name: string;
  role: { name: string; localized_name: string; rank: number; order: number };
  days_in_clan: number | null;
  last_battle_time: number | null;
  personal_rating: number | null;
  battles_count: number | null;
  wins_percentage: number | null;
  damage_per_battle: number | null;
  exp_per_battle: number | null;
  frags_per_battle: number | null;
  battles_per_day: number | null;
  abnormal_results: boolean;
  is_press: boolean;
};

function periodStatsFromRaw(raw: PortalMemberRaw): ClanMemberPeriodStats | null {
  if (
    raw.battles_count === null ||
    raw.wins_percentage === null ||
    raw.damage_per_battle === null ||
    raw.exp_per_battle === null ||
    raw.frags_per_battle === null ||
    raw.battles_per_day === null
  ) {
    return null;
  }
  return {
    battles: raw.battles_count,
    winsPercentage: raw.wins_percentage,
    damagePerBattle: raw.damage_per_battle,
    expPerBattle: raw.exp_per_battle,
    fragsPerBattle: raw.frags_per_battle,
    battlesPerDay: raw.battles_per_day,
  };
}

type NewsfeedAdditional =
  | { old_role: { rank: number; name: string; localized: string }; new_role: { rank: number; name: string; localized: string } }
  | { transaction_id: number; joining_method: string }
  | { transaction_id: number; last_role_name: string };
type NewsfeedItem = {
  type: string;
  created_at: string;
  accounts_ids: number[];
  additional_info: Record<string, NewsfeedAdditional[]>;
  accounts_info: Record<string, { name?: string; role?: string }>;
};

const EVENT_TYPE_ORDER: Record<ClanEventType, number> = {
  [ClanEventType.JoinClan]: 1,
  [ClanEventType.ChangeRole]: 2,
  [ClanEventType.LeaveClan]: 3,
};

function parseNewsfeedDate(s: string): Date {
  return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
}

/** Clan portal (`<region>.wargaming.net/clans/*`) — members roster, newsfeed. */
export class PortalClansResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** Raw clan profile from the portal (`/clans/wot/<id>/api/claninfo/`). */
  async profile({ clanId }: { clanId: number }): Promise<PortalClanProfile> {
    const url = new URL(
      `https://${REGION_PORTAL_HOST[this.region]}/clans/wot/${clanId}/api/claninfo/`,
    );
    return this.t.portalFetch<PortalClanProfile>(this.region, url);
  }

  async #timeframe(clanId: number, timeframe: "all" | "28"): Promise<PortalMemberRaw[]> {
    const url = new URL(
      `https://${REGION_PORTAL_HOST[this.region]}/clans/wot/${clanId}/api/players/`,
    );
    url.searchParams.set("offset", "0");
    url.searchParams.set("limit", "500");
    url.searchParams.set("order", "-personal_rating");
    url.searchParams.set("timeframe", timeframe);
    url.searchParams.set("battle_type", "default");
    const body = await this.t.portalFetch<{ status: string; items: PortalMemberRaw[] }>(
      this.region,
      url,
    );
    return body.items ?? [];
  }

  /** Full member roster (lifetime + last-28d portal stats). */
  async members({ clanId }: { clanId: number }): Promise<PortalClanMember[]> {
    const [allRaws, d28Raws] = await Promise.all([
      this.#timeframe(clanId, "all"),
      this.#timeframe(clanId, "28"),
    ]);
    const d28ByAccount = new Map<number, PortalMemberRaw>();
    for (const m of d28Raws) d28ByAccount.set(m.id, m);
    return allRaws.map((m) => {
      const d28 = d28ByAccount.get(m.id);
      return {
        accountId: m.id,
        name: m.name,
        role: m.role.name as ClanRole,
        roleLocalized: m.role.localized_name,
        roleRank: m.role.rank,
        daysInClan: m.days_in_clan ?? 0,
        lastBattleTime: m.last_battle_time ? new Date(m.last_battle_time * 1000) : null,
        personalRating: m.personal_rating,
        overall: periodStatsFromRaw(m),
        d28: d28 ? periodStatsFromRaw(d28) : null,
      };
    });
  }

  /** Recent join/leave/role-change events from the clan newsfeed. */
  async events({
    clanId,
    maxItems = 30,
  }: {
    clanId: number;
    maxItems?: number;
  }): Promise<ClanRecentEvent[]> {
    const url = new URL(
      `https://${REGION_PORTAL_HOST[this.region]}/clans/wot/${clanId}/newsfeed/api/events/`,
    );
    url.searchParams.set("date_until", new Date().toISOString().replace(/\.\d+Z$/, "+00:00"));
    url.searchParams.set("offset", "0");
    let body: { items: NewsfeedItem[] };
    try {
      body = await this.t.portalFetch<{ items: NewsfeedItem[] }>(this.region, url);
    } catch {
      return [];
    }
    const out: ClanRecentEvent[] = [];
    for (const item of body.items ?? []) {
      if (
        item.type !== ClanEventType.JoinClan &&
        item.type !== ClanEventType.LeaveClan &&
        item.type !== ClanEventType.ChangeRole
      ) {
        continue;
      }
      const createdAt = parseNewsfeedDate(item.created_at);
      for (const [accountIdStr, infos] of Object.entries(item.additional_info)) {
        const accountId = Number(accountIdStr);
        const accountInfo = item.accounts_info[accountIdStr] ?? {};
        for (const info of infos) {
          out.push({
            type: item.type,
            createdAt,
            accountId,
            accountName: accountInfo.name ?? "",
            oldRole: "old_role" in info ? info.old_role.name : null,
            newRole: "new_role" in info ? info.new_role.name : null,
            oldRank: "old_role" in info ? info.old_role.rank : null,
            newRank: "new_role" in info ? info.new_role.rank : null,
          });
        }
      }
      if (out.length >= maxItems) break;
    }
    out.sort((a, b) => {
      const dt = b.createdAt.getTime() - a.createdAt.getTime();
      return dt !== 0 ? dt : EVENT_TYPE_ORDER[b.type] - EVENT_TYPE_ORDER[a.type];
    });
    return out.slice(0, maxItems);
  }
}
