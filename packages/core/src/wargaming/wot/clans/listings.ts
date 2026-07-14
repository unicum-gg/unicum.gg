import { type Region, ClanListOrder } from "@unicum.gg/wargaming";
import { wg } from "../../client";
import { pickEmblem } from "./info";

export type ClanMember = { account_id: number; account_name: string };

export type ClanBriefInfo = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string | null;
  members: ClanMember[];
};

export type PlayerClanInfo = { tag: string; color: string };

const CLAN_LIST_PAGE_SIZE = 100;
const MEMBER_FIELDS = ["members.account_id", "members.account_name"] as const;
const BRIEF_FIELDS = [
  "clan_id",
  "tag",
  "name",
  "color",
  "emblems",
  "members.account_id",
  "members.account_name",
] as const;
const PLAYER_CLAN_FIELDS = ["clan.tag", "clan.color"] as const;

/** Top clan ids by member count. */
export const listTopClansByMembers = async (
  region: Region,
  topN: number,
): Promise<number[]> => {
  const ids: number[] = [];
  let pageNo = 1;
  while (ids.length < topN) {
    const limit = Math.min(CLAN_LIST_PAGE_SIZE, topN - ids.length);
    const result = await wg.region(region).api.wot.clans.list({
      limit,
      pageNo,
      orderBy: ClanListOrder.MembersCountDesc,
      fields: ["clan_id"],
    });
    if (result.length === 0) break;
    ids.push(...result.map((c) => c.clan_id));
    if (result.length < limit) break;
    pageNo += 1;
  }
  return ids;
};

/** Member id/name lists for clans. */
export const getClansMembers = async (
  region: Region,
  clanIds: number[],
): Promise<Map<number, ClanMember[]>> => {
  const byClan = await wg
    .region(region)
    .api.wot.clans.infoBatch({ clanIds, fields: MEMBER_FIELDS });
  const out = new Map<number, ClanMember[]>();
  for (const [id, clan] of byClan) out.set(id, clan.members);
  return out;
};

/** Brief info (badge + members) for clans. */
export const getClansBriefInfo = async (
  region: Region,
  clanIds: number[],
): Promise<ClanBriefInfo[]> => {
  const byClan = await wg
    .region(region)
    .api.wot.clans.infoBatch({ clanIds, fields: BRIEF_FIELDS });
  return Array.from(byClan.values()).map((raw) => ({
    clan_id: raw.clan_id,
    tag: raw.tag,
    name: raw.name,
    color: raw.color,
    emblem: pickEmblem(raw.emblems) || null,
    members: raw.members ?? [],
  }));
};

/** Per-player clan tag/color (`/wot/clans/accountinfo/`). */
export const getPlayerClansBatch = async (
  region: Region,
  accountIds: number[],
): Promise<Map<number, PlayerClanInfo>> => {
  if (accountIds.length === 0) return new Map();
  const byAccount = await wg
    .region(region)
    .api.wot.clans.accountinfoBatch({ accountIds, fields: PLAYER_CLAN_FIELDS });
  const out = new Map<number, PlayerClanInfo>();
  for (const [id, info] of byAccount) {
    if (info.clan) out.set(id, { tag: info.clan.tag, color: info.clan.color });
  }
  return out;
};
