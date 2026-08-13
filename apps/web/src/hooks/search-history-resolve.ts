"use client";

import type { ClanSearchResult } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { TankSearchResult } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import type { MapSearchResult } from "@unicum.gg/core/wargaming/wot/maps";
import { unicum } from "@/services/sdk";
import { itemKey, type SearchHistoryItem } from "./use-search-history";

/** The ids one region's call asks about, in the order the endpoint takes them. */
type RegionIds = {
  players: number[];
  clans: number[];
  tanks: number[];
  maps: string[];
};

function emptyIds(): RegionIds {
  return { players: [], clans: [], tanks: [], maps: [] };
}

function collectIds(items: SearchHistoryItem[]): Map<Region, RegionIds> {
  const byRegion = new Map<Region, RegionIds>();
  for (const item of items) {
    const ids = byRegion.get(item.region) ?? emptyIds();
    byRegion.set(item.region, ids);
    switch (item.kind) {
      case "player":
        ids.players.push(item.player.account_id);
        break;
      case "clan":
        ids.clans.push(item.clan.clan_id);
        break;
      case "tank":
        ids.tanks.push(item.tank.tank_id);
        break;
      case "map":
        ids.maps.push(item.map.arena_id);
        break;
    }
  }
  return byRegion;
}

/** Absent rather than empty: the endpoint reads a missing list as "not asked
 * about", and sending an empty string would be a list with one blank id. */
function csv(ids: (number | string)[]): string | undefined {
  return ids.length > 0 ? ids.join(",") : undefined;
}

/**
 * The current row for every saved entry, keyed the way the store keys them.
 *
 * One request per region held in the list, which in practice is one: a reader
 * pins players and clans from the region they play. Entries the endpoint no
 * longer resolves are simply absent from the map, and the caller keeps what it
 * had for those, so a delisted vehicle or an untracked account stays visible
 * with its last known label instead of vanishing from the list.
 *
 * Never throws: a failed call returns an empty map, which the caller reads as
 * "nothing to update". The list is the reader's own, and it is worth more stale
 * than gone.
 */
export async function resolveHistoryItems(
  items: SearchHistoryItem[],
): Promise<Map<string, SearchHistoryItem>> {
  const fresh = new Map<string, SearchHistoryItem>();
  if (items.length === 0) return fresh;

  const byRegion = collectIds(items);
  await Promise.all(
    [...byRegion].map(async ([region, ids]) => {
      try {
        const resolved = await unicum.region(region).searchResolve({
          players: csv(ids.players),
          clans: csv(ids.clans),
          tanks: csv(ids.tanks),
          maps: csv(ids.maps),
        });
        for (const player of resolved.players) {
          const item: SearchHistoryItem = {
            kind: "player",
            region,
            player: player as unknown as SearchPlayerResult,
          };
          fresh.set(itemKey(item), item);
        }
        for (const clan of resolved.clans) {
          const item: SearchHistoryItem = {
            kind: "clan",
            region,
            clan: clan as unknown as ClanSearchResult,
          };
          fresh.set(itemKey(item), item);
        }
        for (const tank of resolved.tanks) {
          const item: SearchHistoryItem = {
            kind: "tank",
            region,
            tank: tank as unknown as TankSearchResult,
          };
          fresh.set(itemKey(item), item);
        }
        for (const map of resolved.maps) {
          const item: SearchHistoryItem = {
            kind: "map",
            region,
            map: map as unknown as MapSearchResult,
          };
          fresh.set(itemKey(item), item);
        }
      } catch {
        // Region skipped: its entries keep the copy the store already holds.
      }
    }),
  );

  return fresh;
}
