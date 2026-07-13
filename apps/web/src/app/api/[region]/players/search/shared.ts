import { discoverPlayersBackground } from "@unicum.gg/core/discovery/players";
import { searchPlayersLocal } from "@unicum.gg/core/players/search-local";
import { findPlayersByPrefix } from "@unicum.gg/core/wargaming/wot/accounts";
import {
  getPlayerClansBatch,
  type PlayerClanInfo,
} from "@unicum.gg/core/wargaming/wot/clans/listings";
import type { Region } from "@unicum.gg/wargaming/region";

/** A single player search hit. Shared by the plain and NDJSON search routes. */
export type SearchPlayerResult = {
  account_id: number;
  nickname: string;
  clan: PlayerClanInfo | null;
};

const SEARCH_LIMIT = 5;

/** Instant hits from our Postgres mirror (never throws; empty on failure). */
export function searchPlayersLocalPart(
  region: Region,
  query: string,
): Promise<SearchPlayerResult[]> {
  return searchPlayersLocal(region, query, SEARCH_LIMIT).catch(() => []);
}

/** Live Wargaming hits with their clan tag. Caller dedupes against local. */
export async function searchPlayersRemotePart(
  region: Region,
  query: string,
): Promise<SearchPlayerResult[]> {
  const raw = await findPlayersByPrefix(region, query, SEARCH_LIMIT);
  const clans =
    raw.length > 0
      ? await getPlayerClansBatch(
          region,
          raw.map((p) => p.account_id),
        )
      : new Map<number, PlayerClanInfo>();
  return raw.map((p) => ({
    account_id: p.account_id,
    nickname: p.nickname,
    clan: clans.get(p.account_id) ?? null,
  }));
}

/** Feed every hit into the discovery pipeline (fire-and-forget). */
export function discoverPlayers(
  region: Region,
  results: SearchPlayerResult[],
): void {
  discoverPlayersBackground(
    region,
    results.map((r) => ({ accountId: r.account_id, nickname: r.nickname })),
  );
}
