"use client";

import {
  SearchDialog as FumaSearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ClanSearchResponse } from "@/app/api/[region]/clans/search/route";
import type {
  PlayerSearchResponse,
  SearchPlayerResult,
} from "@/app/api/[region]/players/search/route";
import { cn } from "@/lib/utils";
import type { ClanSearchResult } from "@/services/wargaming/wot/clans";
import { REGIONS, type Region } from "@/services/wargaming/wot";

type Outcome<T> =
  | { status: "loading"; previous: T[] | null; forQuery: string }
  | { status: "ok"; results: T[]; forQuery: string }
  | { status: "error"; forQuery: string };

type Section<T> = {
  visible: T[] | null;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
};

type Row =
  | { type: "header"; label: string; key: string }
  | { type: "player"; player: SearchPlayerResult; key: string }
  | { type: "clan"; clan: ClanSearchResult; key: string };

type SelectableRow = Extract<Row, { type: "player" | "clan" }>;

enum SearchType {
  All = "all",
  Players = "players",
  Clans = "clans",
}

const SEARCH_TYPES: SearchType[] = [
  SearchType.All,
  SearchType.Players,
  SearchType.Clans,
];

const SEARCH_TYPE_LABEL: Record<SearchType, string> = {
  [SearchType.All]: "All",
  [SearchType.Players]: "Players",
  [SearchType.Clans]: "Clans",
};

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;

function previousOf<T>(outcome: Outcome<T> | null): T[] | null {
  if (!outcome) return null;
  if (outcome.status === "ok") return outcome.results;
  if (outcome.status === "loading") return outcome.previous;
  return null;
}

function deriveSection<T>(
  enabled: boolean,
  trimmedQuery: string,
  outcome: Outcome<T> | null,
): Section<T> {
  const empty: Section<T> = {
    visible: null,
    isLoading: false,
    isError: false,
    isEmpty: false,
  };
  if (!enabled) return empty;
  if (trimmedQuery.length < MIN_QUERY_LENGTH) return empty;
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
        outcome.previous && outcome.previous.length > 0 ? outcome.previous : null,
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

function flattenSections(
  players: SearchPlayerResult[] | null,
  clans: ClanSearchResult[] | null,
): Row[] {
  const rows: Row[] = [];
  if (players && players.length > 0) {
    rows.push({ type: "header", label: "Players", key: "h-players" });
    for (const player of players) {
      rows.push({ type: "player", player, key: `p-${player.account_id}` });
    }
  }
  if (clans && clans.length > 0) {
    rows.push({ type: "header", label: "Clans", key: "h-clans" });
    for (const clan of clans) {
      rows.push({ type: "clan", clan, key: `c-${clan.clan_id}` });
    }
  }
  return rows;
}

function selectableRows(rows: Row[]): SelectableRow[] {
  return rows.filter((r): r is SelectableRow => r.type !== "header");
}

export default function SearchDialog(props: SharedProps) {
  const router = useRouter();
  const [region, setRegion] = useState<Region>("eu");
  const [searchType, setSearchType] = useState<SearchType>(SearchType.All);
  const [query, setQuery] = useState("");
  const [playersOutcome, setPlayersOutcome] =
    useState<Outcome<SearchPlayerResult> | null>(null);
  const [clansOutcome, setClansOutcome] =
    useState<Outcome<ClanSearchResult> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmedQuery = query.trim();
  const wantPlayers =
    searchType === SearchType.All || searchType === SearchType.Players;
  const wantClans =
    searchType === SearchType.All || searchType === SearchType.Clans;

  const playersSection = useMemo(
    () => deriveSection(wantPlayers, trimmedQuery, playersOutcome),
    [wantPlayers, trimmedQuery, playersOutcome],
  );
  const clansSection = useMemo(
    () => deriveSection(wantClans, trimmedQuery, clansOutcome),
    [wantClans, trimmedQuery, clansOutcome],
  );

  useEffect(() => {
    if (!wantPlayers) setPlayersOutcome(null);
    if (!wantClans) setClansOutcome(null);
    if (trimmedQuery.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const qParam = `q=${encodeURIComponent(trimmedQuery)}`;

      if (wantPlayers) {
        setPlayersOutcome((prev) => ({
          status: "loading",
          previous: previousOf(prev),
          forQuery: trimmedQuery,
        }));
        fetch(`/api/${region}/players/search?${qParam}`, {
          signal: controller.signal,
        })
          .then(async (res) => {
            if (!res.ok) {
              setPlayersOutcome({ status: "error", forQuery: trimmedQuery });
              return;
            }
            const body = (await res.json()) as PlayerSearchResponse;
            setPlayersOutcome({
              status: "ok",
              results: body.results,
              forQuery: trimmedQuery,
            });
            setActiveIndex(0);
          })
          .catch((err) => {
            if (err?.name === "AbortError") return;
            setPlayersOutcome({ status: "error", forQuery: trimmedQuery });
          });
      }

      if (wantClans) {
        setClansOutcome((prev) => ({
          status: "loading",
          previous: previousOf(prev),
          forQuery: trimmedQuery,
        }));
        fetch(`/api/${region}/clans/search?${qParam}`, {
          signal: controller.signal,
        })
          .then(async (res) => {
            if (!res.ok) {
              setClansOutcome({ status: "error", forQuery: trimmedQuery });
              return;
            }
            const body = (await res.json()) as ClanSearchResponse;
            setClansOutcome({
              status: "ok",
              results: body.results,
              forQuery: trimmedQuery,
            });
            setActiveIndex(0);
          })
          .catch((err) => {
            if (err?.name === "AbortError") return;
            setClansOutcome({ status: "error", forQuery: trimmedQuery });
          });
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmedQuery, region, wantPlayers, wantClans]);

  const rows = useMemo(
    () => flattenSections(playersSection.visible, clansSection.visible),
    [playersSection.visible, clansSection.visible],
  );
  const selectable = useMemo(() => selectableRows(rows), [rows]);

  const anyLoading = playersSection.isLoading || clansSection.isLoading;
  const allErrored = playersSection.isError && clansSection.isError;
  const allEmpty = playersSection.isEmpty && clansSection.isEmpty;
  const hasAnyVisible = rows.length > 0;

  const showArea = hasAnyVisible || anyLoading || allErrored || allEmpty;

  const frozenRowsRef = useRef<Row[]>(rows);
  const frozenSelectableRef = useRef<SelectableRow[]>(selectable);
  const frozenStatusRef = useRef<{
    anyLoading: boolean;
    allErrored: boolean;
    allEmpty: boolean;
    hasAnyVisible: boolean;
  }>({ anyLoading, allErrored, allEmpty, hasAnyVisible });

  useEffect(() => {
    if (showArea) {
      frozenRowsRef.current = rows;
      frozenSelectableRef.current = selectable;
      frozenStatusRef.current = {
        anyLoading,
        allErrored,
        allEmpty,
        hasAnyVisible,
      };
    }
  }, [showArea, rows, selectable, anyLoading, allErrored, allEmpty, hasAnyVisible]);

  const renderRows = showArea ? rows : frozenRowsRef.current;
  const renderStatus = showArea
    ? { anyLoading, allErrored, allEmpty, hasAnyVisible }
    : frozenStatusRef.current;

  function close() {
    props.onOpenChange?.(false);
    setQuery("");
    setPlayersOutcome(null);
    setClansOutcome(null);
  }

  function pickPlayer(p: SearchPlayerResult) {
    close();
    router.push(`/${region}/players/${encodeURIComponent(p.nickname)}`);
  }

  function pickClan(c: ClanSearchResult) {
    close();
    router.push(`/${region}/clans/${encodeURIComponent(c.tag)}`);
  }

  function pickRow(row: SelectableRow) {
    if (row.type === "player") pickPlayer(row.player);
    else pickClan(row.clan);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (selectable.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
          close();
          router.push(
            `/${region}/players/${encodeURIComponent(trimmedQuery)}`,
          );
        }
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, selectable.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = selectable[activeIndex];
      if (pick) pickRow(pick);
    }
  }

  return (
    <FumaSearchDialog search={query} onSearchChange={setQuery} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent className="bg-fd-popover/80 backdrop-blur-lg">
        <div className="relative">
          <SearchDialogHeader>
            <SearchDialogIcon />
            <SearchDialogInput
              placeholder="Search players or clans"
              onKeyDown={onKeyDown}
            />
            <SearchDialogClose />
          </SearchDialogHeader>
          <LoadingBar active={anyLoading} />
        </div>

        <FilterBar
          region={region}
          onRegionChange={setRegion}
          searchType={searchType}
          onSearchTypeChange={setSearchType}
        />

        <AnimatedHeight open={showArea}>
          <ResultsArea
            status={renderStatus}
            rows={renderRows}
            activeIndex={activeIndex}
            onPick={pickRow}
            onHover={setActiveIndex}
          />
        </AnimatedHeight>
      </SearchDialogContent>
    </FumaSearchDialog>
  );
}

function FilterBar({
  region,
  onRegionChange,
  searchType,
  onSearchTypeChange,
}: {
  region: Region;
  onRegionChange: (r: Region) => void;
  searchType: SearchType;
  onSearchTypeChange: (t: SearchType) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-fd-muted-foreground">Region:</span>
        {REGIONS.map((r) => (
          <button
            type="button"
            key={r}
            onClick={() => onRegionChange(r)}
            className={cn(
              "rounded px-2 py-1 font-medium uppercase transition-colors",
              r === region
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-fd-muted-foreground">Show:</span>
        {SEARCH_TYPES.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => onSearchTypeChange(t)}
            className={cn(
              "rounded px-2 py-1 font-medium uppercase transition-colors",
              t === searchType
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {SEARCH_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultsArea({
  status,
  rows,
  activeIndex,
  onPick,
  onHover,
}: {
  status: {
    anyLoading: boolean;
    allErrored: boolean;
    allEmpty: boolean;
    hasAnyVisible: boolean;
  };
  rows: Row[];
  activeIndex: number;
  onPick: (row: SelectableRow) => void;
  onHover: (index: number) => void;
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
          return (
            <li key={row.key}>
              <button
                type="button"
                data-row-index={idx}
                onClick={() => onPick(row)}
                onMouseEnter={() => onHover(idx)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "bg-fd-accent text-fd-accent-foreground"
                    : "text-fd-foreground/90",
                )}
              >
                {row.type === "player" ? (
                  <PlayerRow player={row.player} />
                ) : (
                  <ClanRow clan={row.clan} />
                )}
              </button>
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

function PlayerRow({ player }: { player: SearchPlayerResult }) {
  return (
    <>
      <span className="truncate font-medium">{player.nickname}</span>
      {player.clan ? (
        <span className="shrink-0 font-mono text-xs font-semibold">
          <span style={{ color: player.clan.color }}>[</span>
          {player.clan.tag}
          <span style={{ color: player.clan.color }}>]</span>
        </span>
      ) : null}
    </>
  );
}

function ClanRow({ clan }: { clan: ClanSearchResult }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {clan.emblem ? (
          <img
            src={clan.emblem}
            alt=""
            width={20}
            height={20}
            className="size-5 shrink-0 rounded-sm"
          />
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <span className="font-mono text-sm font-semibold">
          <span style={{ color: clan.color }}>[</span>
          {clan.tag}
          <span style={{ color: clan.color }}>]</span>
        </span>
        <span className="truncate text-sm text-fd-muted-foreground">
          {clan.name}
        </span>
      </span>
      <span className="shrink-0 text-xs text-fd-muted-foreground">
        {clan.members_count} members
      </span>
    </>
  );
}

function LoadingBar({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="h-full w-2/5 animate-loading-bar bg-linear-to-r from-transparent via-fd-primary to-transparent" />
    </div>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-fd-border px-4 py-6 text-center text-sm text-fd-muted-foreground">
      {children}
    </div>
  );
}

function AnimatedHeight({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [innerHeight, setInnerHeight] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setInnerHeight(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      data-empty={!open ? "true" : undefined}
      className="overflow-hidden transition-[height] duration-200 ease-out"
      style={{ height: open ? innerHeight : 0 }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
