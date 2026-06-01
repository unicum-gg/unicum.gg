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

export async function getClanFullInfo(
  region: Region,
  clanId: number,
): Promise<ClanFullInfo | null> {
  const [data, languages] = await Promise.all([
    wgFetch<Record<string, RawClanFullInfo | null>>(region, "/wot/clans/info/", {
      clan_id: String(clanId),
      fields:
        "clan_id,tag,name,color,motto,description_html,members_count,leader_id,leader_name,creator_id,creator_name,created_at,is_clan_disbanded,emblems",
    }),
    getClanLanguages(region, clanId),
  ]);
  const raw = data[String(clanId)];
  if (!raw) return null;
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
