import type { Region } from "@/services/wargaming/wot";
import { wgFetch } from "@/services/wargaming/wot/fetch";

export type ClanRef = {
  id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
};

export type ClanStint = {
  clan: ClanRef;
  joinedAt: Date;
  leftAt: Date | null;
  role: string;
  roleLocalized: string;
};

export type PlayerClanHistoryFull = {
  currentStint: ClanStint | null;
  pastStints: ClanStint[];
  totalClans: number;
  timeInClansSeconds: number;
};

type Emblems = Record<string, { portal?: string; wot?: string }> | null;

function pickEmblem(emblems: Emblems): string {
  return (
    emblems?.x195?.portal ??
    emblems?.x64?.portal ??
    emblems?.x64?.wot ??
    emblems?.x32?.portal ??
    ""
  );
}

type AccountInfoEntry = {
  joined_at: number;
  role: string;
  role_i18n: string;
  clan: {
    clan_id: number;
    tag: string;
    name: string;
    color: string;
    emblems: Emblems;
  };
} | null;

/**
 * Returns the player's current clan as a stint, or null if they are not in
 * a clan. Single public API call to `/wot/clans/accountinfo/` — replaces a
 * direct portal hit that was Cloudflare-blocked from many networks.
 */
export async function getPlayerCurrentClan(
  region: Region,
  accountId: number,
): Promise<ClanStint | null> {
  const data = await wgFetch<Record<string, AccountInfoEntry>>(
    region,
    "/wot/clans/accountinfo/",
    {
      account_id: String(accountId),
      fields:
        "joined_at,role,role_i18n,clan.clan_id,clan.tag,clan.name,clan.color,clan.emblems",
    },
  );
  const entry = data[String(accountId)];
  if (!entry?.clan) return null;
  return {
    clan: {
      id: entry.clan.clan_id,
      tag: entry.clan.tag,
      name: entry.clan.name,
      color: entry.clan.color,
      emblem: pickEmblem(entry.clan.emblems),
    },
    joinedAt: new Date(entry.joined_at * 1000),
    leftAt: null,
    role: entry.role,
    roleLocalized: entry.role_i18n,
  };
}

export type RawClanMemberStint = {
  clanId: number;
  role: string;
  joinedAt: Date;
  leftAt: Date;
};

type RawMemberHistoryEntry = {
  role: string;
  left_at: number;
  clan_id: number;
  joined_at: number;
};

/**
 * Past clan stints only — current membership is intentionally absent from
 * this endpoint. Returned in WG order (most-recent first). Clan refs are not
 * embedded; resolve via the `clans` table or `getClansShortRefBatch`.
 */
export async function getPlayerClanMemberHistory(
  region: Region,
  accountId: number,
): Promise<RawClanMemberStint[]> {
  const data = await wgFetch<Record<string, RawMemberHistoryEntry[] | null>>(
    region,
    "/wot/clans/memberhistory/",
    { account_id: String(accountId) },
  );
  const entries = data[String(accountId)];
  if (!entries) return [];
  return entries.map((e) => ({
    clanId: e.clan_id,
    role: e.role,
    joinedAt: new Date(e.joined_at * 1000),
    leftAt: new Date(e.left_at * 1000),
  }));
}
