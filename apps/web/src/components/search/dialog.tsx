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
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ClanSearchChunk } from "@/app/api/[region]/clans/search/route";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { PlayerSearchChunk } from "@/app/api/[region]/players/search/route";
import type {
  TankSearchChunk,
  TankSearchResult,
} from "@/app/api/[region]/tanks/search/route";
import { SearchSource } from "@unicum.gg/core/search";
import { FilterBar, SearchType } from "@/components/search/filter-bar";
import {
  type Outcome,
  ResultsArea,
  type ResultsStatus,
  type Row,
  type SelectableRow,
  deriveSection,
  flattenHistory,
  flattenSections,
  previousOf,
  rowToItem,
  selectableRows,
} from "@/components/search/results-area";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { useSearchHistory } from "@/hooks/use-search-history";
import { readNdjson } from "@/lib/ndjson";
import { cn } from "@/lib/utils";
import type { ClanSearchResult } from "@unicum.gg/core/wargaming/wot/clans/search";
import {
  isRegion,
  Region,
  regionFromPathname,
} from "@unicum.gg/wargaming/region";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;

export default function SearchDialog(props: SharedProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [storedRegion, setStoredRegion] = useCookie(
    STORAGE.COOKIES.REGION,
    Region.EU,
  );
  // Source of truth = URL (e.g. /asia/...) over cookie. The user is
  // browsing that region right now; default the search to it.
  const urlRegion = regionFromPathname(pathname);
  const defaultRegion: Region =
    urlRegion ?? (isRegion(storedRegion) ? storedRegion : Region.EU);
  const [region, setRegionState] = useState<Region>(defaultRegion);
  // Sync region with URL changes without an effect (cheaper, plays nice
  // with React 19 purity rules). React re-renders before commit when
  // setState is called during render with a different value.
  const [trackedUrlRegion, setTrackedUrlRegion] = useState(urlRegion);
  if (urlRegion !== trackedUrlRegion) {
    setTrackedUrlRegion(urlRegion);
    if (urlRegion) setRegionState(urlRegion);
  }
  const setRegion = (r: Region) => {
    setRegionState(r);
    setStoredRegion(r);
    // Also navigate so the navbar selector and any region-aware UI stay
    // aligned. Without this, the dialog flips to EU while the navbar
    // still says ASIA until the user actually picks a search result.
    if (urlRegion && urlRegion !== r) {
      router.push(ROUTES.HOME(r));
    }
  };
  const [searchType, setSearchType] = useState<SearchType>(SearchType.All);
  const [query, setQuery] = useState("");
  const [playersOutcome, setPlayersOutcome] =
    useState<Outcome<SearchPlayerResult> | null>(null);
  const [clansOutcome, setClansOutcome] =
    useState<Outcome<ClanSearchResult> | null>(null);
  const [tanksOutcome, setTanksOutcome] =
    useState<Outcome<TankSearchResult> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const {
    recent,
    favorites,
    addRecent,
    removeRecent,
    toggleFavorite,
    isFavorite,
  } = useSearchHistory();

  const trimmedQuery = query.trim();
  const wantPlayers =
    searchType === SearchType.All || searchType === SearchType.Players;
  const wantClans =
    searchType === SearchType.All || searchType === SearchType.Clans;
  const wantTanks =
    searchType === SearchType.All || searchType === SearchType.Tanks;

  const playersSection = useMemo(
    () => deriveSection(wantPlayers, trimmedQuery, MIN_QUERY_LENGTH, playersOutcome),
    [wantPlayers, trimmedQuery, playersOutcome],
  );
  const clansSection = useMemo(
    () => deriveSection(wantClans, trimmedQuery, MIN_QUERY_LENGTH, clansOutcome),
    [wantClans, trimmedQuery, clansOutcome],
  );
  const tanksSection = useMemo(
    () => deriveSection(wantTanks, trimmedQuery, MIN_QUERY_LENGTH, tanksOutcome),
    [wantTanks, trimmedQuery, tanksOutcome],
  );

  useEffect(() => {
    if (!wantPlayers) setPlayersOutcome(null);
    if (!wantClans) setClansOutcome(null);
    if (!wantTanks) setTanksOutcome(null);
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
            let acc: SearchPlayerResult[] = [];
            await readNdjson<PlayerSearchChunk>(res, (chunk) => {
              acc = [...acc, ...chunk.results];
              setPlayersOutcome({
                status: "ok",
                results: acc,
                forQuery: trimmedQuery,
              });
              if (chunk.source === SearchSource.Local) setActiveIndex(0);
            });
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
            let acc: ClanSearchResult[] = [];
            await readNdjson<ClanSearchChunk>(res, (chunk) => {
              acc = [...acc, ...chunk.results];
              setClansOutcome({
                status: "ok",
                results: acc,
                forQuery: trimmedQuery,
              });
              if (chunk.source === SearchSource.Local) setActiveIndex(0);
            });
          })
          .catch((err) => {
            if (err?.name === "AbortError") return;
            setClansOutcome({ status: "error", forQuery: trimmedQuery });
          });
      }

      if (wantTanks) {
        setTanksOutcome((prev) => ({
          status: "loading",
          previous: previousOf(prev),
          forQuery: trimmedQuery,
        }));
        fetch(`/api/${region}/tanks/search?${qParam}`, {
          signal: controller.signal,
        })
          .then(async (res) => {
            if (!res.ok) {
              setTanksOutcome({ status: "error", forQuery: trimmedQuery });
              return;
            }
            let acc: TankSearchResult[] = [];
            await readNdjson<TankSearchChunk>(res, (chunk) => {
              acc = [...acc, ...chunk.results];
              setTanksOutcome({
                status: "ok",
                results: acc,
                forQuery: trimmedQuery,
              });
              if (chunk.source === SearchSource.Local) setActiveIndex(0);
            });
          })
          .catch((err) => {
            if (err?.name === "AbortError") return;
            setTanksOutcome({ status: "error", forQuery: trimmedQuery });
          });
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmedQuery, region, wantPlayers, wantClans, wantTanks]);

  // When the input is empty, show the user's recent + favorite items
  // instead of a blank state. The search results take over the moment
  // they start typing.
  const queryIsEmpty = trimmedQuery.length < MIN_QUERY_LENGTH;
  const historyRows = useMemo(
    () => (queryIsEmpty ? flattenHistory(recent, favorites) : []),
    [queryIsEmpty, recent, favorites],
  );
  const searchRows = useMemo(
    () =>
      flattenSections(
        region,
        playersSection.visible,
        clansSection.visible,
        tanksSection.visible,
      ),
    [region, playersSection.visible, clansSection.visible, tanksSection.visible],
  );
  const rows = queryIsEmpty ? historyRows : searchRows;
  const selectable = useMemo(() => selectableRows(rows), [rows]);

  const anyLoading =
    playersSection.isLoading || clansSection.isLoading || tanksSection.isLoading;
  const allErrored =
    playersSection.isError && clansSection.isError && tanksSection.isError;
  const allEmpty =
    playersSection.isEmpty && clansSection.isEmpty && tanksSection.isEmpty;
  const hasAnyVisible = rows.length > 0;

  const showArea = hasAnyVisible || anyLoading || allErrored || allEmpty;

  // Freeze content during close animation so the dialog doesn't flash
  // empty before unmounting. Refs hold the last-painted rows/status.
  const frozenRowsRef = useRef<Row[]>(rows);
  const frozenSelectableRef = useRef<SelectableRow[]>(selectable);
  const frozenStatusRef = useRef<ResultsStatus>({
    anyLoading,
    allErrored,
    allEmpty,
    hasAnyVisible,
  });

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
  const renderStatus: ResultsStatus = showArea
    ? { anyLoading, allErrored, allEmpty, hasAnyVisible }
    : frozenStatusRef.current;

  function close() {
    props.onOpenChange?.(false);
    setQuery("");
    setPlayersOutcome(null);
    setClansOutcome(null);
    setTanksOutcome(null);
  }

  function pickRow(row: SelectableRow) {
    close();
    if (row.type === "player") {
      addRecent(rowToItem(row));
      router.push(ROUTES.PLAYER(row.region, row.player.nickname));
    } else if (row.type === "clan") {
      addRecent(rowToItem(row));
      router.push(ROUTES.CLAN(row.region, row.clan.tag));
    } else {
      addRecent(rowToItem(row));
      router.push(ROUTES.TANK(row.region, row.tank.slug));
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (selectable.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
          close();
          router.push(ROUTES.PLAYER(region, trimmedQuery));
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
              placeholder="Search players, clans or tanks"
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
            isFavorite={(row) => isFavorite(rowToItem(row))}
            onToggleFavorite={(row) => toggleFavorite(rowToItem(row))}
            onRemoveRecent={(row) => removeRecent(rowToItem(row))}
          />
        </AnimatedHeight>
      </SearchDialogContent>
    </FumaSearchDialog>
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
