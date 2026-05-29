import { type Region, wgFetch } from ".";

export type ClanInfo = {
  clan_id: number;
  name: string;
  tag: string;
  color: string;
  emblem: string | null;
};

type RawClanInfo = {
  clan_id: number;
  name: string;
  tag: string;
  color: string;
  emblems: Record<string, { portal?: string; wot?: string; wowp?: string }>;
};

export async function getClanInfo(
  region: Region,
  clanId: number,
): Promise<ClanInfo | null> {
  const data = await wgFetch<Record<string, RawClanInfo | null>>(
    region,
    "/wot/clans/info/",
    {
      clan_id: String(clanId),
      fields: "clan_id,name,tag,color,emblems",
    },
  );
  const raw = data[String(clanId)];
  if (!raw) return null;
  return {
    clan_id: raw.clan_id,
    name: raw.name,
    tag: raw.tag,
    color: raw.color,
    emblem:
      raw.emblems.x64?.portal ??
      raw.emblems.x64?.wot ??
      raw.emblems.x32?.portal ??
      null,
  };
}

export type AccountClanInfo = {
  role: string;
  role_i18n: string;
  joined_at: number;
};

export async function getAccountClanInfo(
  region: Region,
  accountId: number,
): Promise<AccountClanInfo | null> {
  const data = await wgFetch<Record<string, AccountClanInfo | null>>(
    region,
    "/wot/clans/accountinfo/",
    {
      account_id: String(accountId),
      fields: "role,role_i18n,joined_at",
    },
  );
  return data[String(accountId)] ?? null;
}
