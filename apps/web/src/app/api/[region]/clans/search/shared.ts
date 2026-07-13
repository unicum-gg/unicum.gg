import { searchClansLocal } from "@unicum.gg/core/clans/search-local";
import { discoverClansBackground } from "@unicum.gg/core/discovery/clans";
import {
  findClansByPrefix,
  type ClanSearchResult,
} from "@unicum.gg/core/wargaming/wot/clans/search";
import type { Region } from "@unicum.gg/wargaming/region";

const SEARCH_LIMIT = 5;

/** Instant hits from our Postgres mirror (never throws; empty on failure). */
export function searchClansLocalPart(
  region: Region,
  query: string,
): Promise<ClanSearchResult[]> {
  return searchClansLocal(region, query, SEARCH_LIMIT).catch(() => []);
}

/** Live Wargaming hits. Caller dedupes against local. */
export function searchClansRemotePart(
  region: Region,
  query: string,
): Promise<ClanSearchResult[]> {
  return findClansByPrefix(region, query, SEARCH_LIMIT).catch((err) => {
    console.error(`[api/${region}/clans/search] remote failed:`, err);
    return [] as ClanSearchResult[];
  });
}

/** Feed every hit into the discovery pipeline (fire-and-forget). */
export function discoverClans(
  region: Region,
  results: ClanSearchResult[],
): void {
  discoverClansBackground(
    region,
    results.map((r) => r.clan_id),
  );
}
