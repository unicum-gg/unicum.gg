import sanitizeHtml from "sanitize-html";
import {
  portalFetch,
  type Region,
  REGION_PORTAL_HOST,
  wgFetch,
} from "@/services/wargaming/wot";

export type ClanFullInfo = {
  id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
  motto: string;
  descriptionHtml: string;
  createdAt: Date;
  membersCount: number;
  leaderId: number;
  leaderName: string;
  isDisbanded: boolean;
};

type RawClanFullInfo = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  motto: string;
  description_html: string;
  members_count: number;
  leader_id: number;
  leader_name: string;
  created_at: number;
  is_clan_disbanded: boolean;
  emblems: Record<string, { portal?: string; wot?: string }>;
};

const DESCRIPTION_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "a", "ul", "ol", "li"],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer",
    }),
  },
};

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;
const TRAILING_PUNCT_REGEX = /([.,;:!?)\]}>]+)$/;
const DOUBLE_ENCODED_ENTITY_REGEX = /&amp;(#?\w+;)/g;

function linkifyPlainUrls(html: string): string {
  return html.replace(URL_REGEX, (match) => {
    const trail = match.match(TRAILING_PUNCT_REGEX);
    const url = trail ? match.slice(0, -trail[0].length) : match;
    const tail = trail ? trail[0] : "";
    return `<a href="${url}">${url}</a>${tail}`;
  });
}

function unescapeDoubleEntities(html: string): string {
  return html.replace(DOUBLE_ENCODED_ENTITY_REGEX, "&$1");
}

export async function findClanIdByTag(
  region: Region,
  tag: string,
): Promise<number | null> {
  const result = await wgFetch<Array<{ clan_id: number; tag: string }>>(
    region,
    "/wot/clans/list/",
    {
      search: tag,
      limit: "20",
      fields: "clan_id,tag",
    },
  );
  const upper = tag.toUpperCase();
  const match = result.find((c) => c.tag.toUpperCase() === upper);
  return match?.clan_id ?? null;
}

export async function getClanFullInfo(
  region: Region,
  clanId: number,
): Promise<ClanFullInfo | null> {
  const data = await wgFetch<Record<string, RawClanFullInfo | null>>(
    region,
    "/wot/clans/info/",
    {
      clan_id: String(clanId),
      fields:
        "clan_id,tag,name,color,motto,description_html,members_count,leader_id,leader_name,created_at,is_clan_disbanded,emblems",
    },
  );
  const raw = data[String(clanId)];
  if (!raw) return null;
  const emblem =
    raw.emblems.x64?.portal ??
    raw.emblems.x64?.wot ??
    raw.emblems.x32?.portal ??
    "";
  return {
    id: raw.clan_id,
    tag: raw.tag,
    name: raw.name,
    color: raw.color,
    emblem,
    motto: raw.motto ?? "",
    descriptionHtml: sanitizeHtml(
      linkifyPlainUrls(unescapeDoubleEntities(raw.description_html ?? "")),
      DESCRIPTION_SANITIZE_OPTIONS,
    ),
    createdAt: new Date(raw.created_at * 1000),
    membersCount: raw.members_count,
    leaderId: raw.leader_id,
    leaderName: raw.leader_name,
    isDisbanded: raw.is_clan_disbanded,
  };
}

type PortalMemberRaw = {
  id: number;
  name: string;
  role: {
    name: string;
    localized_name: string;
    rank: number;
    order: number;
  };
  days_in_clan: number;
  last_battle_time: number | null;
  personal_rating: number;
  battles_count: number;
  wins_percentage: number;
  damage_per_battle: number;
  exp_per_battle: number;
  frags_per_battle: number;
  battles_per_day: number;
  abnormal_results: boolean;
  is_press: boolean;
};

type PortalMembersResponse = {
  status: string;
  items: PortalMemberRaw[];
};

export type ClanMemberPeriodStats = {
  battles: number;
  winsPercentage: number;
  damagePerBattle: number;
  expPerBattle: number;
  fragsPerBattle: number;
  battlesPerDay: number;
};

export type ClanMemberStats = {
  accountId: number;
  name: string;
  role: string;
  roleLocalized: string;
  roleRank: number;
  daysInClan: number;
  lastBattleTime: Date | null;
  personalRating: number;
  overall: ClanMemberPeriodStats;
  d28: ClanMemberPeriodStats | null;
};

function periodStatsFromRaw(raw: PortalMemberRaw): ClanMemberPeriodStats {
  return {
    battles: raw.battles_count,
    winsPercentage: raw.wins_percentage,
    damagePerBattle: raw.damage_per_battle,
    expPerBattle: raw.exp_per_battle,
    fragsPerBattle: raw.frags_per_battle,
    battlesPerDay: raw.battles_per_day,
  };
}

async function fetchClanMembersTimeframe(
  region: Region,
  clanId: number,
  timeframe: "all" | "28",
): Promise<PortalMemberRaw[]> {
  const url = new URL(
    `https://${REGION_PORTAL_HOST[region]}/clans/wot/${clanId}/api/players/`,
  );
  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", "500");
  url.searchParams.set("order", "-personal_rating");
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("battle_type", "default");
  const body = await portalFetch<PortalMembersResponse>(url);
  return body.items ?? [];
}

export async function getClanMembersStats(
  region: Region,
  clanId: number,
): Promise<ClanMemberStats[]> {
  const [allRaws, d28Raws] = await Promise.all([
    fetchClanMembersTimeframe(region, clanId, "all"),
    fetchClanMembersTimeframe(region, clanId, "28"),
  ]);
  const d28ByAccount = new Map<number, PortalMemberRaw>();
  for (const m of d28Raws) d28ByAccount.set(m.id, m);

  return allRaws.map((m) => {
    const d28 = d28ByAccount.get(m.id);
    return {
      accountId: m.id,
      name: m.name,
      role: m.role.name,
      roleLocalized: m.role.localized_name,
      roleRank: m.role.rank,
      daysInClan: m.days_in_clan,
      lastBattleTime: m.last_battle_time
        ? new Date(m.last_battle_time * 1000)
        : null,
      personalRating: m.personal_rating,
      overall: periodStatsFromRaw(m),
      d28: d28 ? periodStatsFromRaw(d28) : null,
    };
  });
}

export type ClanMember = { account_id: number; account_name: string };

const CLAN_LIST_PAGE_SIZE = 100;
const CLAN_INFO_BATCH_SIZE = 100;

export async function listTopClansByMembers(
  region: Region,
  topN: number,
): Promise<number[]> {
  const ids: number[] = [];
  let pageNo = 1;
  while (ids.length < topN) {
    const limit = Math.min(CLAN_LIST_PAGE_SIZE, topN - ids.length);
    const result = await wgFetch<Array<{ clan_id: number }>>(
      region,
      "/wot/clans/list/",
      {
        limit: String(limit),
        page_no: String(pageNo),
        order_by: "-members_count",
        fields: "clan_id",
      },
    );
    if (result.length === 0) break;
    ids.push(...result.map((c) => c.clan_id));
    if (result.length < limit) break;
    pageNo += 1;
  }
  return ids;
}

export async function getClansMembers(
  region: Region,
  clanIds: number[],
): Promise<Map<number, ClanMember[]>> {
  const out = new Map<number, ClanMember[]>();
  for (let i = 0; i < clanIds.length; i += CLAN_INFO_BATCH_SIZE) {
    const batch = clanIds.slice(i, i + CLAN_INFO_BATCH_SIZE);
    const data = await wgFetch<
      Record<string, { members: ClanMember[] } | null>
    >(region, "/wot/clans/info/", {
      clan_id: batch.join(","),
      fields: "members.account_id,members.account_name",
    });
    for (const [id, clan] of Object.entries(data)) {
      if (!clan) continue;
      out.set(Number(id), clan.members);
    }
  }
  return out;
}
