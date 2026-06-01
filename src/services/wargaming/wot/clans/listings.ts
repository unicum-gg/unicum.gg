import type { Region } from "@/services/wargaming/wot";
import { wgFetch } from "@/services/wargaming/wot/fetch";

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

export type ClanBriefInfo = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string | null;
  members: ClanMember[];
};

type RawClanBriefInfo = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  emblems: Record<string, { portal?: string; wot?: string }>;
  members: ClanMember[];
};

export async function getClansBriefInfo(
  region: Region,
  clanIds: number[],
): Promise<ClanBriefInfo[]> {
  const out: ClanBriefInfo[] = [];
  for (let i = 0; i < clanIds.length; i += CLAN_INFO_BATCH_SIZE) {
    const batch = clanIds.slice(i, i + CLAN_INFO_BATCH_SIZE);
    const data = await wgFetch<Record<string, RawClanBriefInfo | null>>(
      region,
      "/wot/clans/info/",
      {
        clan_id: batch.join(","),
        fields:
          "clan_id,tag,name,color,emblems,members.account_id,members.account_name",
      },
    );
    for (const raw of Object.values(data)) {
      if (!raw) continue;
      out.push({
        clan_id: raw.clan_id,
        tag: raw.tag,
        name: raw.name,
        color: raw.color,
        emblem: raw.emblems.x64?.portal ?? raw.emblems.x64?.wot ?? null,
        members: raw.members ?? [],
      });
    }
  }
  return out;
}

export type PlayerClanInfo = {
  tag: string;
  color: string;
};

type RawMembersInfo = {
  clan: { tag: string; color: string } | null;
} | null;

export async function getPlayerClansBatch(
  region: Region,
  accountIds: number[],
): Promise<Map<number, PlayerClanInfo>> {
  if (accountIds.length === 0) return new Map();
  const data = await wgFetch<Record<string, RawMembersInfo>>(
    region,
    "/wgn/clans/membersinfo/",
    {
      account_id: accountIds.join(","),
      fields: "clan.tag,clan.color",
    },
  );
  const out = new Map<number, PlayerClanInfo>();
  for (const [id, info] of Object.entries(data)) {
    if (info?.clan) {
      out.set(Number(id), { tag: info.clan.tag, color: info.clan.color });
    }
  }
  return out;
}
