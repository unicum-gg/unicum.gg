import type { Region } from "@unicum.gg/wargaming";
import { getClansByIds, type LocalClanResult } from "../clans/search-local";
import { getPlayersByAccountIds, type LocalPlayerResult } from "../players/search-local";
import { getMapsByIds, type MapSearchResult } from "../wargaming/wot/maps/search";
import {
  getTanksByIds,
  type TankSearchResult,
} from "../wargaming/wot/tanks/resolve";

/**
 * What a saved search entry is: an id, and nothing else worth trusting.
 *
 * The search dialog keeps the rows a reader pinned or last visited, and it used
 * to keep the row itself, nickname and clan tag included. Those are the two
 * fields most likely to be wrong a week later: a player leaves a clan, a clan
 * renames, and the pinned copy still shows what was true the day it was pinned,
 * down to linking a nickname that no longer resolves. The id is the only part
 * that outlives the display, so it is the only part stored, and this turns a
 * list of ids back into rows.
 */
export type SearchEntryIds = {
  players: number[];
  clans: number[];
  tanks: number[];
  maps: string[];
};

export type ResolvedSearchEntries = {
  players: LocalPlayerResult[];
  clans: LocalClanResult[];
  tanks: TankSearchResult[];
  maps: MapSearchResult[];
};

/** How many entries one call resolves per kind. A reader pins a handful and the
 * recents are capped at five, so this only bounds a hand-made request. */
export const MAX_ENTRIES_PER_KIND = 50;

/**
 * Current rows for a set of saved entries, in the shapes the search endpoints
 * already return, so the dialog renders a resolved entry and a fresh search hit
 * with the same component.
 *
 * Cheap by construction: two indexed reads for the players and the clans, and
 * two in-memory catalogue lookups for the vehicles and the maps, which touch
 * neither the database nor Wargaming.
 */
export async function resolveSearchEntries(
  region: Region,
  ids: SearchEntryIds,
): Promise<ResolvedSearchEntries> {
  const [players, clans, tanks, maps] = await Promise.all([
    getPlayersByAccountIds(region, ids.players.slice(0, MAX_ENTRIES_PER_KIND)),
    getClansByIds(region, ids.clans.slice(0, MAX_ENTRIES_PER_KIND)),
    getTanksByIds(region, ids.tanks.slice(0, MAX_ENTRIES_PER_KIND)),
    getMapsByIds(region, ids.maps.slice(0, MAX_ENTRIES_PER_KIND)),
  ]);

  return { players, clans, tanks, maps };
}
