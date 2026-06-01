import type { Region } from "@/services/wargaming/wot";
import { wgFetch } from "@/services/wargaming/wot/fetch";

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

export type ClanSearchResult = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  members_count: number;
  emblem: string | null;
};

type RawClanSearchResult = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  members_count: number;
  emblems: Record<string, { portal?: string; wot?: string }>;
};

export async function findClansByPrefix(
  region: Region,
  prefix: string,
  limit = 10,
): Promise<ClanSearchResult[]> {
  const raw = await wgFetch<RawClanSearchResult[]>(
    region,
    "/wot/clans/list/",
    {
      search: prefix,
      limit: String(limit),
      fields: "clan_id,tag,name,color,members_count,emblems",
    },
  );
  return raw.map((c) => ({
    clan_id: c.clan_id,
    tag: c.tag,
    name: c.name,
    color: c.color,
    members_count: c.members_count,
    emblem: c.emblems.x32?.portal ?? c.emblems.x32?.wot ?? null,
  }));
}
