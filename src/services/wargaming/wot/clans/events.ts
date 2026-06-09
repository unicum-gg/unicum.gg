import {
  type Region,
  REGION_PORTAL_HOST,
} from "@/services/wargaming/wot";
import { portalFetch } from "@/services/wargaming/wot/fetch";

export enum ClanEventType {
  JoinClan = "join_clan",
  LeaveClan = "leave_clan",
  ChangeRole = "change_role",
}

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

type NewsfeedAccountInfo = { name?: string; role?: string };

type NewsfeedAdditional =
  | {
      old_role: { rank: number; name: string; localized: string };
      new_role: { rank: number; name: string; localized: string };
    }
  | { transaction_id: number; joining_method: string }
  | { transaction_id: number; last_role_name: string };

type NewsfeedItem = {
  type: string;
  created_at: string;
  accounts_ids: number[];
  additional_info: Record<string, NewsfeedAdditional[]>;
  accounts_info: Record<string, NewsfeedAccountInfo>;
};

type NewsfeedResponse = {
  items: NewsfeedItem[];
};

function parseNewsfeedDate(s: string): Date {
  return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
}

const EVENT_TYPE_ORDER: Record<ClanEventType, number> = {
  [ClanEventType.JoinClan]: 1,
  [ClanEventType.ChangeRole]: 2,
  [ClanEventType.LeaveClan]: 3,
};

export async function getClanRecentEvents(
  region: Region,
  clanId: number,
  maxItems = 30,
): Promise<ClanRecentEvent[]> {
  const url = new URL(
    `https://${REGION_PORTAL_HOST[region]}/clans/wot/${clanId}/newsfeed/api/events/`,
  );
  url.searchParams.set(
    "date_until",
    new Date().toISOString().replace(/\.\d+Z$/, "+00:00"),
  );
  url.searchParams.set("offset", "0");
  let body: NewsfeedResponse;
  try {
    body = await portalFetch<NewsfeedResponse>(url);
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
    if (dt !== 0) return dt;
    return EVENT_TYPE_ORDER[b.type] - EVENT_TYPE_ORDER[a.type];
  });
  return out.slice(0, maxItems);
}
