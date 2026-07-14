import type { Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";
import { pickEmblem } from "./info";

export type ClanSearchResult = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  members_count: number;
  emblem: string | null;
};

const SEARCH_FIELDS = [
  "clan_id",
  "tag",
  "name",
  "color",
  "members_count",
  "emblems",
] as const;

/** Resolve a clan tag to its id via exact-tag search. */
export const findClanIdByTag = async (region: Region, tag: string): Promise<number | null> => {
  const results = await wg.region(region).api.wot.clans.list({
    search: tag,
    limit: 20,
    fields: ["clan_id", "tag"],
  });
  const upper = tag.toUpperCase();
  return results.find((c) => c.tag.toUpperCase() === upper)?.clan_id ?? null;
};

/** Prefix search by tag/name. */
export const findClansByPrefix = async (
  region: Region,
  prefix: string,
  limit = 10,
): Promise<ClanSearchResult[]> => {
  const raw = await wg.region(region).api.wot.clans.list({
    search: prefix,
    limit,
    fields: SEARCH_FIELDS,
  });
  return raw.map((c) => ({
    clan_id: c.clan_id,
    tag: c.tag,
    name: c.name,
    color: c.color,
    members_count: c.members_count,
    emblem: pickEmblem(c.emblems) || null,
  }));
};
