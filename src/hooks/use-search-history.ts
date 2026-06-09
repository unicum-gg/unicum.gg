"use client";

import { useCallback, useEffect, useState } from "react";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import STORAGE from "@/constants/storage";
import type { Region } from "@/services/wargaming/wot";
import type { ClanSearchResult } from "@/services/wargaming/wot/clans/search";

export type SearchHistoryItem =
  | { kind: "player"; region: Region; player: SearchPlayerResult }
  | { kind: "clan"; region: Region; clan: ClanSearchResult };

type SearchHistory = {
  recent: SearchHistoryItem[];
  favorites: SearchHistoryItem[];
};

const STORAGE_KEY = STORAGE.LOCAL_STORAGE.SEARCH_HISTORY;
const MAX_RECENT = 3;

const EMPTY: SearchHistory = { recent: [], favorites: [] };

function itemKey(item: SearchHistoryItem): string {
  return item.kind === "player"
    ? `p:${item.region}:${item.player.account_id}`
    : `c:${item.region}:${item.clan.clan_id}`;
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

export function useSearchHistory() {
  const [state, setState] = useState<SearchHistory>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage on mount
    setState(loadFromStorage());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips the "we've checked localStorage" flag once on mount
    setHydrated(true);
    // The native `storage` event fires only for changes from OTHER tabs
    // or windows. Reload our state when that happens so multiple open
    // tabs stay in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setState(loadFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Persist on every change (state-driven). Pure setState updaters above
  // avoid running this side effect inside the updater itself, which
  // misbehaves under React 19 strict mode (updaters are double-invoked).
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const addRecent = useCallback((item: SearchHistoryItem) => {
    setState((prev) => {
      const key = itemKey(item);
      return {
        favorites: prev.favorites,
        recent: [item, ...prev.recent.filter((i) => itemKey(i) !== key)].slice(
          0,
          MAX_RECENT,
        ),
      };
    });
  }, []);

  const removeRecent = useCallback((item: SearchHistoryItem) => {
    setState((prev) => {
      const key = itemKey(item);
      return {
        favorites: prev.favorites,
        recent: prev.recent.filter((i) => itemKey(i) !== key),
      };
    });
  }, []);

  const toggleFavorite = useCallback((item: SearchHistoryItem) => {
    setState((prev) => {
      const key = itemKey(item);
      const isFav = prev.favorites.some((i) => itemKey(i) === key);
      return {
        recent: prev.recent,
        favorites: isFav
          ? prev.favorites.filter((i) => itemKey(i) !== key)
          : [...prev.favorites, item],
      };
    });
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
