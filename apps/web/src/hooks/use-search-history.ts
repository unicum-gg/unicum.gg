"use client";

import { useCallback, useEffect, useState } from "react";
import { resolveHistoryItems } from "./search-history-resolve";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import STORAGE from "@/constants/storage";
import type { Region } from "@unicum.gg/wargaming";
import type { ClanSearchResult } from "@unicum.gg/shared";
import type { TankSearchResult } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import type { MapSearchResult } from "@unicum.gg/core/wargaming/wot/maps";

export type SearchHistoryItem =
  | { kind: "player"; region: Region; player: SearchPlayerResult }
  | { kind: "clan"; region: Region; clan: ClanSearchResult }
  | { kind: "tank"; region: Region; tank: TankSearchResult }
  | { kind: "map"; region: Region; map: MapSearchResult };

type SearchHistory = {
  recent: SearchHistoryItem[];
  favorites: SearchHistoryItem[];
};

const STORAGE_KEY = STORAGE.LOCAL_STORAGE.SEARCH_HISTORY;
const MAX_RECENT = 5;

const EMPTY: SearchHistory = { recent: [], favorites: [] };

/**
 * What identifies an entry, and the only part of it worth trusting over time.
 *
 * A stored entry carries the row it was pinned from (nickname, clan tag, colors)
 * so the list paints instantly and still reads offline, but that copy is a
 * photograph: players change clan, clans rename. `refresh()` asks the API for
 * the current row of each of these ids and swaps the copy, so the key has to
 * survive everything the display can change.
 */
export function itemKey(item: SearchHistoryItem): string {
  switch (item.kind) {
    case "player":
      return `p:${item.region}:${item.player.account_id}`;
    case "clan":
      return `c:${item.region}:${item.clan.clan_id}`;
    case "tank":
      return `t:${item.region}:${item.tank.tank_id}`;
    case "map":
      return `m:${item.region}:${item.map.arena_id}`;
  }
}

function loadFromStorage(): SearchHistory {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<SearchHistory>;
    return {
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    };
  } catch {
    return EMPTY;
  }
}

// Module-level shared state so all useSearchHistory instances on the same
// page stay in sync without a React context provider.
let sharedState: SearchHistory = EMPTY;
const listeners = new Set<(s: SearchHistory) => void>();

function broadcast(next: SearchHistory) {
  sharedState = next;
  for (const fn of listeners) fn(next);
}

function persist(next: SearchHistory) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

// Cross-tab sync — storage event only fires for OTHER tabs, which is exactly
// what we want here (same-tab sync is handled by broadcast()).
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    broadcast(loadFromStorage());
  });
}

export function useSearchHistory() {
  const [state, setState] = useState<SearchHistory>(sharedState);

  useEffect(() => {
    listeners.add(setState);
    // Hydrate from localStorage on mount and broadcast to all instances.
    broadcast(loadFromStorage());
    return () => { listeners.delete(setState); };
  }, []);

  const addRecent = useCallback((item: SearchHistoryItem) => {
    const key = itemKey(item);
    const next = {
      favorites: sharedState.favorites,
      recent: [item, ...sharedState.recent.filter((i) => itemKey(i) !== key)].slice(0, MAX_RECENT),
    };
    broadcast(next);
    persist(next);
  }, []);

  const removeRecent = useCallback((item: SearchHistoryItem) => {
    const key = itemKey(item);
    const next = {
      favorites: sharedState.favorites,
      recent: sharedState.recent.filter((i) => itemKey(i) !== key),
    };
    broadcast(next);
    persist(next);
  }, []);

  const toggleFavorite = useCallback((item: SearchHistoryItem) => {
    const key = itemKey(item);
    const isFav = sharedState.favorites.some((i) => itemKey(i) === key);
    const next = {
      recent: sharedState.recent,
      favorites: isFav
        ? sharedState.favorites.filter((i) => itemKey(i) !== key)
        : [...sharedState.favorites, item],
    };
    broadcast(next);
    persist(next);
  }, []);

  const isFavorite = useCallback(
    (item: SearchHistoryItem): boolean => {
      const key = itemKey(item);
      return state.favorites.some((i) => itemKey(i) === key);
    },
    [state.favorites],
  );

  return {
    recent: state.recent,
    favorites: state.favorites,
    addRecent,
    removeRecent,
    toggleFavorite,
    isFavorite,
    refresh: refreshFromApi,
  };
}

/** How long a resolved list is considered current. The dialog asks on every
 * open, and a reader opens it many times a session, so this keeps the common
 * case free while a clan change still lands within the minute. */
const REFRESH_INTERVAL_MS = 60_000;
let lastRefreshAt = 0;

/**
 * Replace each entry's stored copy with the row the API returns for its id.
 *
 * Call it when the list is about to be read. Everything the copy holds beyond
 * the id is a display detail that goes out of date on its own: a favorited
 * player who changed clan kept showing the old tag, and one who was renamed kept
 * a label that no longer opened a page. Entries the API does not resolve keep
 * their copy, so the list never loses a row over a failed lookup.
 */
async function refreshFromApi(): Promise<void> {
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_INTERVAL_MS) return;
  lastRefreshAt = now;

  const before = sharedState;
  const fresh = await resolveHistoryItems([
    ...before.recent,
    ...before.favorites,
  ]);
  if (fresh.size === 0) {
    // Nothing came back (no entries, or every region's call failed). Let the
    // next open try again rather than sitting out the interval.
    lastRefreshAt = 0;
    return;
  }

  const apply = (list: SearchHistoryItem[]) =>
    list.map((item) => fresh.get(itemKey(item)) ?? item);
  const next: SearchHistory = {
    recent: apply(before.recent),
    favorites: apply(before.favorites),
  };
  // A toggle may have landed while the request was in flight, and the lists are
  // rewritten wholesale here, so a stale write would resurrect what it removed.
  if (sharedState !== before) return;
  if (JSON.stringify(next) === JSON.stringify(before)) return;
  broadcast(next);
  persist(next);
}
