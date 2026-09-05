import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { TankSearchResult } from "@/app/api/[region]/tanks/search/route";
import type { MapSearchResult } from "@/app/api/[region]/maps/search/route";
import type { SearchHistoryItem } from "@/hooks/use-search-history";
import type { ClanSearchResult, GlossarySummary } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * What the search dialog shows, as data: one section's fetch state, and the flat
 * list of rows the sections and the saved entries both collapse into. Kept apart
 * from the component that paints it because the keyboard, the prefetch and the
 * history all read the same list, and none of them render anything.
 */
export type Outcome<T> =
  | { status: "loading"; previous: T[] | null; forQuery: string }
  // Partial results are in, but the NDJSON stream is still open (the remote
  // Wargaming chunk hasn't landed): show what we have AND keep the loading
  // indicator on, so nothing "pops in" without feedback and the empty state
  // never flashes before the remote hits arrive.
  | { status: "streaming"; results: T[]; forQuery: string }
  | { status: "ok"; results: T[]; forQuery: string }
  | { status: "error"; forQuery: string };

export type Section<T> = {
  visible: T[] | null;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
};

export type Row =
  | { type: "header"; label: string; key: string }
  | {
      type: "player";
      player: SearchPlayerResult;
      region: Region;
      key: string;
      isRecent?: boolean;
    }
  | {
      type: "clan";
      clan: ClanSearchResult;
      region: Region;
      key: string;
      isRecent?: boolean;
    }
  | {
      type: "tank";
      tank: TankSearchResult;
      region: Region;
      key: string;
      isRecent?: boolean;
    }
  | {
      type: "map";
      map: MapSearchResult;
      region: Region;
      key: string;
      isRecent?: boolean;
    }
  // No region: a definition reads the same on every server, so the glossary is
  // region-less all the way down to its URL.
  | {
      type: "glossary";
      term: GlossarySummary;
      key: string;
      isRecent?: boolean;
    };

export type SelectableRow = Extract<
  Row,
  { type: "player" | "clan" | "tank" | "map" | "glossary" }
>;
// Rows that can be pinned as a favorite / kept in recent — every selectable one.
export type HistoryRow = SelectableRow;

export type ResultsStatus = {
  anyLoading: boolean;
  allErrored: boolean;
  allEmpty: boolean;
  hasAnyVisible: boolean;
};

export function previousOf<T>(outcome: Outcome<T> | null): T[] | null {
  if (!outcome) return null;
  if (outcome.status === "ok" || outcome.status === "streaming")
    return outcome.results;
  if (outcome.status === "loading") return outcome.previous;
  return null;
}

export function deriveSection<T>(
  enabled: boolean,
  trimmedQuery: string,
  minQueryLength: number,
  outcome: Outcome<T> | null,
): Section<T> {
  const empty: Section<T> = {
    visible: null,
    isLoading: false,
    isError: false,
    isEmpty: false,
  };
  if (!enabled) return empty;
  if (trimmedQuery.length < minQueryLength) return empty;
  if (!outcome || outcome.forQuery !== trimmedQuery) {
    const prev = previousOf(outcome);
    return {
      visible: prev && prev.length > 0 ? prev : null,
      isLoading: true,
      isError: false,
      isEmpty: false,
    };
  }
  if (outcome.status === "loading") {
    return {
      visible:
        outcome.previous && outcome.previous.length > 0
          ? outcome.previous
          : null,
      isLoading: true,
      isError: false,
      isEmpty: false,
    };
  }
  if (outcome.status === "error") {
    return { visible: null, isLoading: false, isError: true, isEmpty: false };
  }
  // Still streaming: show partial results but stay in the loading state, so the
  // empty state can't flash before the remote chunk arrives.
  if (outcome.status === "streaming") {
    return {
      visible: outcome.results.length > 0 ? outcome.results : null,
      isLoading: true,
      isError: false,
      isEmpty: false,
    };
  }
  return {
    visible: outcome.results.length > 0 ? outcome.results : null,
    isLoading: false,
    isError: false,
    isEmpty: outcome.results.length === 0,
  };
}

/** The visible sections, in reading order, as one flat list. */
export type SearchSections = {
  players: SearchPlayerResult[] | null;
  clans: ClanSearchResult[] | null;
  tanks: TankSearchResult[] | null;
  maps: MapSearchResult[] | null;
  glossary: GlossarySummary[] | null;
};

export function flattenSections(
  region: Region,
  sections: SearchSections,
): Row[] {
  const rows: Row[] = [];
  const { players, clans, tanks, maps, glossary } = sections;
  if (players && players.length > 0) {
    rows.push({ type: "header", label: "Players", key: "h-players" });
    for (const player of players) {
      rows.push({
        type: "player",
        player,
        region,
        key: `p-${player.account_id}`,
      });
    }
  }
  if (clans && clans.length > 0) {
    rows.push({ type: "header", label: "Clans", key: "h-clans" });
    for (const clan of clans) {
      rows.push({
        type: "clan",
        clan,
        region,
        key: `c-${clan.clan_id}`,
      });
    }
  }
  if (tanks && tanks.length > 0) {
    rows.push({ type: "header", label: "Tanks", key: "h-tanks" });
    for (const tank of tanks) {
      rows.push({
        type: "tank",
        tank,
        region,
        key: `t-${tank.tank_id}`,
      });
    }
  }
  if (maps && maps.length > 0) {
    rows.push({ type: "header", label: "Maps", key: "h-maps" });
    for (const map of maps) {
      rows.push({
        type: "map",
        map,
        region,
        key: `m-${map.arena_id}`,
      });
    }
  }
  if (glossary && glossary.length > 0) {
    rows.push({ type: "header", label: "Glossary", key: "h-glossary" });
    for (const term of glossary) {
      rows.push({ type: "glossary", term, key: `g-${term.slug}` });
    }
  }
  return rows;
}

function sameItem(a: SearchHistoryItem, b: SearchHistoryItem): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "glossary" && b.kind === "glossary")
    return a.term.slug === b.term.slug;
  if (a.kind === "glossary" || b.kind === "glossary") return false;
  if (a.region !== b.region) return false;
  if (a.kind === "player" && b.kind === "player")
    return a.player.account_id === b.player.account_id;
  if (a.kind === "clan" && b.kind === "clan")
    return a.clan.clan_id === b.clan.clan_id;
  if (a.kind === "tank" && b.kind === "tank")
    return a.tank.tank_id === b.tank.tank_id;
  if (a.kind === "map" && b.kind === "map")
    return a.map.arena_id === b.map.arena_id;
  return false;
}

export function flattenHistory(
  recent: SearchHistoryItem[],
  favorites: SearchHistoryItem[],
): Row[] {
  // Hide recents that are already pinned as favorites to avoid showing the
  // same row twice in two sections back-to-back.
  const dedupedRecent = recent.filter(
    (r) => !favorites.some((f) => sameItem(r, f)),
  );
  const rows: Row[] = [];
  if (dedupedRecent.length > 0) {
    rows.push({ type: "header", label: "Recent", key: "h-recent" });
    for (const item of dedupedRecent) rows.push(itemToRow(item, true));
  }
  if (favorites.length > 0) {
    rows.push({ type: "header", label: "Favorites", key: "h-favorites" });
    for (const item of favorites) rows.push(itemToRow(item, false));
  }
  return rows;
}

export function selectableRows(rows: Row[]): SelectableRow[] {
  return rows.filter((r): r is SelectableRow => r.type !== "header");
}

export function itemToRow(
  item: SearchHistoryItem,
  isRecent: boolean,
): SelectableRow {
  const keyPrefix = isRecent ? "r" : "f";
  if (item.kind === "player") {
    return {
      type: "player",
      player: item.player,
      region: item.region,
      key: `${keyPrefix}-p-${item.region}-${item.player.account_id}`,
      isRecent,
    };
  }
  if (item.kind === "clan") {
    return {
      type: "clan",
      clan: item.clan,
      region: item.region,
      key: `${keyPrefix}-c-${item.region}-${item.clan.clan_id}`,
      isRecent,
    };
  }
  if (item.kind === "tank") {
    return {
      type: "tank",
      tank: item.tank,
      region: item.region,
      key: `${keyPrefix}-t-${item.region}-${item.tank.tank_id}`,
      isRecent,
    };
  }
  if (item.kind === "glossary") {
    return {
      type: "glossary",
      term: item.term,
      key: `${keyPrefix}-g-${item.term.slug}`,
      isRecent,
    };
  }
  return {
    type: "map",
    map: item.map,
    region: item.region,
    key: `${keyPrefix}-m-${item.region}-${item.map.arena_id}`,
    isRecent,
  };
}

export function rowToItem(row: HistoryRow): SearchHistoryItem {
  if (row.type === "player")
    return { kind: "player", region: row.region, player: row.player };
  if (row.type === "clan")
    return { kind: "clan", region: row.region, clan: row.clan };
  if (row.type === "tank")
    return { kind: "tank", region: row.region, tank: row.tank };
  if (row.type === "glossary") return { kind: "glossary", term: row.term };
  return { kind: "map", region: row.region, map: row.map };
}
