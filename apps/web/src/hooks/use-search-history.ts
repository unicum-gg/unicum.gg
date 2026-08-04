"use client";

import { useCallback, useEffect, useState } from "react";
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

function itemKey(item: SearchHistoryItem): string {
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
  };
}
