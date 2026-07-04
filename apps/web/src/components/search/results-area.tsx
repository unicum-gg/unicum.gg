"use client";

import { StarIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import { ClanRow, PlayerRow } from "@/components/search/rows";
import type { SearchHistoryItem } from "@/hooks/use-search-history";
import { cn } from "@/lib/utils";
import type { ClanSearchResult } from "@/services/wargaming/wot/clans/search";
import type { Region } from "@unicum.gg/wargaming/region";

export type Outcome<T> =
  | { status: "loading"; previous: T[] | null; forQuery: string }
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
    };

export type SelectableRow = Extract<Row, { type: "player" | "clan" }>;

export type ResultsStatus = {
  anyLoading: boolean;
  allErrored: boolean;
  allEmpty: boolean;
  hasAnyVisible: boolean;
};

export function previousOf<T>(outcome: Outcome<T> | null): T[] | null {
  if (!outcome) return null;
  if (outcome.status === "ok") return outcome.results;
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
  return {
    visible: outcome.results.length > 0 ? outcome.results : null,
    isLoading: false,
    isError: false,
    isEmpty: outcome.results.length === 0,
  };
}

export function flattenSections(
  region: Region,
  players: SearchPlayerResult[] | null,
  clans: ClanSearchResult[] | null,
): Row[] {
  const rows: Row[] = [];
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
  return rows;
}

function sameItem(a: SearchHistoryItem, b: SearchHistoryItem): boolean {
  if (a.region !== b.region || a.kind !== b.kind) return false;
  return a.kind === "player" && b.kind === "player"
    ? a.player.account_id === b.player.account_id
    : a.kind === "clan" && b.kind === "clan"
      ? a.clan.clan_id === b.clan.clan_id
      : false;
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
  return {
    type: "clan",
    clan: item.clan,
    region: item.region,
    key: `${keyPrefix}-c-${item.region}-${item.clan.clan_id}`,
    isRecent,
  };
}

export function rowToItem(row: SelectableRow): SearchHistoryItem {
  return row.type === "player"
    ? { kind: "player", region: row.region, player: row.player }
    : { kind: "clan", region: row.region, clan: row.clan };
}

export function ResultsArea({
  status,
  rows,
  activeIndex,
  onPick,
  onHover,
  isFavorite,
  onToggleFavorite,
  onRemoveRecent,
}: {
  status: ResultsStatus;
  rows: Row[];
  activeIndex: number;
  onPick: (row: SelectableRow) => void;
  onHover: (index: number) => void;
  isFavorite: (row: SelectableRow) => boolean;
  onToggleFavorite: (row: SelectableRow) => void;
  onRemoveRecent: (row: SelectableRow) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-row-index="${activeIndex}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (rows.length > 0) {
    let selectableIndex = -1;
    return (
      <ul
        ref={listRef}
        className="max-h-96 overflow-y-auto border-t border-fd-border py-1"
      >
        {rows.map((row) => {
          if (row.type === "header") {
            return (
              <li key={row.key}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fd-muted-foreground">
                  {row.label}
                </div>
              </li>
            );
          }
          selectableIndex += 1;
          const idx = selectableIndex;
          const isActive = idx === activeIndex;
          const fav = isFavorite(row);
          return (
            <li
              key={row.key}
              className={cn(
                "group flex items-center rounded transition-colors",
                isActive
                  ? "bg-fd-accent text-fd-accent-foreground"
                  : "text-fd-foreground/90",
              )}
              onMouseEnter={() => onHover(idx)}
            >
              <button
                type="button"
                data-row-index={idx}
                onClick={() => onPick(row)}
                className="flex flex-1 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm"
              >
                {row.type === "player" ? (
                  <PlayerRow player={row.player} />
                ) : (
                  <ClanRow clan={row.clan} />
                )}
              </button>
              <div className="flex shrink-0 items-center gap-1 pr-2">
                {row.isRecent ? (
                  <RowActionButton
                    onClick={() => onRemoveRecent(row)}
                    label="Remove from recent"
                  >
                    <XIcon className="size-3.5" weight="bold" />
                  </RowActionButton>
                ) : null}
                <RowActionButton
                  onClick={() => onToggleFavorite(row)}
                  label={fav ? "Remove from favorites" : "Add to favorites"}
                >
                  <StarIcon
                    className={cn("size-3.5", fav ? "text-fd-primary" : "")}
                    weight={fav ? "fill" : "regular"}
                  />
                </RowActionButton>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  if (status.anyLoading) return <Status>Searching…</Status>;
  if (status.allErrored) return <Status>Something went wrong. Try again.</Status>;
  if (status.allEmpty) return <Status>No results found</Status>;
  return null;
}

function RowActionButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-fd-muted-foreground hover:bg-fd-border/50 hover:text-fd-foreground"
    >
      {children}
    </button>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-fd-border px-4 py-6 text-center text-sm text-fd-muted-foreground">
      {children}
    </div>
  );
}
