import {
  type Region,
  REGION_PORTAL_HOST,
} from "@/services/wargaming/wot";
import { portalFetch, wgFetch } from "@/services/wargaming/wot/fetch";
import { sanitizeClanDescription } from "./description";

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
  creatorId: number;
  creatorName: string;
  isDisbanded: boolean;
  languages: string[];
};

type PortalClanInfo = {
  clanview?: {
    profiles?: Array<{
      type?: string;
      languages_list?: string[];
    }>;
  };
};

async function getClanLanguages(
  region: Region,
  clanId: number,
): Promise<string[]> {
  try {
    const url = new URL(
      `https://${REGION_PORTAL_HOST[region]}/clans/wot/${clanId}/api/claninfo/`,
    );
    const data = await portalFetch<PortalClanInfo>(url);
    const profile = data.clanview?.profiles?.find((p) => p.type === "clan");
    return profile?.languages_list ?? [];
  } catch {
    return [];
  }
}

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
  creator_id: number;
  creator_name: string;
  created_at: number;
  is_clan_disbanded: boolean;
  emblems: Record<string, { portal?: string; wot?: string }>;
};

const CLAN_INFO_FIELDS =
  "clan_id,tag,name,color,motto,description_html,members_count,leader_id,leader_name,creator_id,creator_name,created_at,is_clan_disbanded,emblems";

function clanFullInfoFromRaw(
  raw: RawClanFullInfo,
  languages: string[],
): ClanFullInfo {
  const emblem =
    raw.emblems.x195?.portal ??
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
    descriptionHtml: sanitizeClanDescription(raw.description_html),
    createdAt: new Date(raw.created_at * 1000),
    membersCount: raw.members_count,
    leaderId: raw.leader_id,
    leaderName: raw.leader_name,
    creatorId: raw.creator_id,
    creatorName: raw.creator_name,
    isDisbanded: raw.is_clan_disbanded,
    languages,
  };
}

export async function getClanFullInfo(
  region: Region,
  clanId: number,
): Promise<ClanFullInfo | null> {
  const [data, languages] = await Promise.all([
    wgFetch<Record<string, RawClanFullInfo | null>>(region, "/wot/clans/info/", {
      clan_id: String(clanId),
      fields: CLAN_INFO_FIELDS,
    }),
    getClanLanguages(region, clanId),
  ]);
  const raw = data[String(clanId)];
  if (!raw) return null;
  return clanFullInfoFromRaw(raw, languages);
}

const CLAN_FULL_INFO_BATCH_SIZE = 100;
const LANGUAGES_CONCURRENCY = 5;

export async function getClansFullInfoBatch(
  region: Region,
  clanIds: number[],
): Promise<Map<number, ClanFullInfo>> {
  const out = new Map<number, ClanFullInfo>();
  const unique = Array.from(new Set(clanIds));
  if (unique.length === 0) return out;

  // 1. Batched WG calls in parallel
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += CLAN_FULL_INFO_BATCH_SIZE) {
    chunks.push(unique.slice(i, i + CLAN_FULL_INFO_BATCH_SIZE));
  }
  const wgResults = await Promise.allSettled(
    chunks.map((batch) =>
      wgFetch<Record<string, RawClanFullInfo | null>>(
        region,
        "/wot/clans/info/",
        { clan_id: batch.join(","), fields: CLAN_INFO_FIELDS },
      ),
    ),
  );

  // 2. Portal languages, concurrency-limited
  const languagesMap = new Map<number, string[]>();
  for (let i = 0; i < unique.length; i += LANGUAGES_CONCURRENCY) {
    const batch = unique.slice(i, i + LANGUAGES_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (id) => [id, await getClanLanguages(region, id)] as const),
    );
    for (const [id, langs] of results) languagesMap.set(id, langs);
  }

  for (const res of wgResults) {
    if (res.status === "rejected") {
      console.error("[clans-info-batch] chunk failed:", res.reason);
      continue;
    }
    for (const [id, raw] of Object.entries(res.value)) {
      if (!raw) continue;
      const cid = Number(id);
      out.set(cid, clanFullInfoFromRaw(raw, languagesMap.get(cid) ?? []));
    }
  }
  return out;
}
