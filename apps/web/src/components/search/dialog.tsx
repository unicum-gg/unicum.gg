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
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { TankSearchResult } from "@/app/api/[region]/tanks/search/route";
import type { MapSearchResult } from "@/app/api/[region]/maps/search/route";
import { SearchSource, type ClanSearchResult } from "@unicum.gg/shared";
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
import { mergeSearchChunks } from "@/lib/search-merge";
import { unicum } from "@/services/sdk";
import { cn } from "@/lib/utils";
import {
  isRegion,
  Region,
  regionFromPathname,
} from "@unicum.gg/wargaming";

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
  const [mapsOutcome, setMapsOutcome] =
    useState<Outcome<MapSearchResult> | null>(null);
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
  const wantMaps =
    searchType === SearchType.All || searchType === SearchType.Maps;

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
  const mapsSection = useMemo(
    () => deriveSection(wantMaps, trimmedQuery, MIN_QUERY_LENGTH, mapsOutcome),
    [wantMaps, trimmedQuery, mapsOutcome],
  );

  useEffect(() => {
    // A disabled section (`!wantX`) or a too-short query is hidden by
    // `deriveSection`, which also ignores an outcome left over from another
    // query — so there's nothing to clear here, we just skip fetching.
    if (trimmedQuery.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (wantPlayers) {
        setPlayersOutcome((prev) => ({
          status: "loading",
          previous: previousOf(prev),
          forQuery: trimmedQuery,
        }));
        void (async () => {
          try {
            // The two chunks merge into one capped list (exact match hoisted)
            // instead of appending, so the section stays at one page and the
            // count doesn't double when the WG chunk lands.
            let local: SearchPlayerResult[] = [];
            let remote: SearchPlayerResult[] = [];
            const merged = () =>
              mergeSearchChunks(local, remote, (r) => r.nickname, trimmedQuery);
            for await (const chunk of unicum
              .region(region)
              .players.searchStream(trimmedQuery, {
                signal: controller.signal,
              })) {
              const results = chunk.results as SearchPlayerResult[];
              if (chunk.source === SearchSource.Local) local = results;
              else remote = results;
              // Partial: keep the loading indicator on until the stream ends.
              setPlayersOutcome({
                status: "streaming",
                results: merged(),
                forQuery: trimmedQuery,
              });
              if (chunk.source === SearchSource.Local) setActiveIndex(0);
            }
            // Stream closed (remote chunk landed): settle to the final result.
            setPlayersOutcome({
              status: "ok",
              results: merged(),
              forQuery: trimmedQuery,
            });
          } catch (err) {
            if ((err as Error)?.name === "AbortError") return;
            setPlayersOutcome({ status: "error", forQuery: trimmedQuery });
          }
        })();
      }

      if (wantClans) {
        setClansOutcome((prev) => ({
          status: "loading",
          previous: previousOf(prev),
          forQuery: trimmedQuery,
        }));
        void (async () => {
          try {
            // Same merge-not-append as the players section (exact tag first).
            let local: ClanSearchResult[] = [];
            let remote: ClanSearchResult[] = [];
            const merged = () =>
              mergeSearchChunks(local, remote, (r) => r.tag, trimmedQuery);
            for await (const chunk of unicum
              .region(region)
              .clans.searchStream(trimmedQuery, {
                signal: controller.signal,
              })) {
              const results = chunk.results as ClanSearchResult[];
              if (chunk.source === SearchSource.Local) local = results;
              else remote = results;
              // Partial: keep the loading indicator on until the stream ends.
              setClansOutcome({
                status: "streaming",
                results: merged(),
                forQuery: trimmedQuery,
              });
              if (chunk.source === SearchSource.Local) setActiveIndex(0);
            }
            // Stream closed (remote chunk landed): settle to the final result.
            setClansOutcome({
              status: "ok",
              results: merged(),
              forQuery: trimmedQuery,
            });
          } catch (err) {
            if ((err as Error)?.name === "AbortError") return;
            setClansOutcome({ status: "error", forQuery: trimmedQuery });
          }
        })();
      }

      if (wantTanks) {
        setTanksOutcome((prev) => ({
          status: "loading",
          previous: previousOf(prev),
          forQuery: trimmedQuery,
        }));
        void (async () => {
          try {
            let acc: TankSearchResult[] = [];
            for await (const chunk of unicum
              .region(region)
              .tanks.searchStream(trimmedQuery, {
                signal: controller.signal,
              })) {
              acc = [...acc, ...(chunk.results as TankSearchResult[])];
              // Partial: keep the loading indicator on until the stream ends.
              setTanksOutcome({
                status: "streaming",
                results: acc,
                forQuery: trimmedQuery,
              });
              if (chunk.source === SearchSource.Local) setActiveIndex(0);
            }
            // Stream closed: settle to the final result.
            setTanksOutcome({
              status: "ok",
              results: acc,
              forQuery: trimmedQuery,
            });
          } catch (err) {
            if ((err as Error)?.name === "AbortError") return;
            setTanksOutcome({ status: "error", forQuery: trimmedQuery });
          }
        })();
      }

      if (wantMaps) {
        setMapsOutcome((prev) => ({
          status: "loading",
          previous: previousOf(prev),
          forQuery: trimmedQuery,
        }));
        void (async () => {
          try {
            let acc: MapSearchResult[] = [];
            for await (const chunk of unicum
              .region(region)
              .maps.searchStream(trimmedQuery, {
                signal: controller.signal,
              })) {
              acc = [...acc, ...(chunk.results as MapSearchResult[])];
              // Partial: keep the loading indicator on until the stream ends.
              setMapsOutcome({
                status: "streaming",
                results: acc,
                forQuery: trimmedQuery,
              });
              if (chunk.source === SearchSource.Local) setActiveIndex(0);
            }
            // Stream closed: settle to the final result.
            setMapsOutcome({
              status: "ok",
              results: acc,
              forQuery: trimmedQuery,
            });
          } catch (err) {
            if ((err as Error)?.name === "AbortError") return;
            setMapsOutcome({ status: "error", forQuery: trimmedQuery });
          }
        })();
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmedQuery, region, wantPlayers, wantClans, wantTanks, wantMaps]);

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
        mapsSection.visible,
      ),
    [
      region,
      playersSection.visible,
      clansSection.visible,
      tanksSection.visible,
      mapsSection.visible,
    ],
  );
  const rows = queryIsEmpty ? historyRows : searchRows;
  const selectable = useMemo(() => selectableRows(rows), [rows]);

  const anyLoading =
    playersSection.isLoading ||
    clansSection.isLoading ||
    tanksSection.isLoading ||
    mapsSection.isLoading;
  const allErrored =
    playersSection.isError &&
    clansSection.isError &&
    tanksSection.isError &&
    mapsSection.isError;
  const allEmpty =
    playersSection.isEmpty &&
    clansSection.isEmpty &&
    tanksSection.isEmpty &&
    mapsSection.isEmpty;
  const hasAnyVisible = rows.length > 0;

  const showArea = hasAnyVisible || anyLoading || allErrored || allEmpty;

  // Freeze content during the close animation so the dialog doesn't flash empty
  // before unmounting: keep the last-painted rows + status and refresh them
  // while the area is shown. Uses React's "value from a previous render"
  // pattern (conditional set-state during render) rather than a ref read during
  // render or a state update from an effect.
  const liveStatus: ResultsStatus = {
    anyLoading,
    allErrored,
    allEmpty,
    hasAnyVisible,
  };
  const [frozen, setFrozen] = useState<{ rows: Row[]; status: ResultsStatus }>({
    rows,
    status: liveStatus,
  });
  if (
    showArea &&
    (frozen.rows !== rows ||
      frozen.status.anyLoading !== anyLoading ||
      frozen.status.allErrored !== allErrored ||
      frozen.status.allEmpty !== allEmpty ||
      frozen.status.hasAnyVisible !== hasAnyVisible)
  ) {
    setFrozen({ rows, status: liveStatus });
  }

  const renderRows = showArea ? rows : frozen.rows;
  const renderStatus: ResultsStatus = showArea ? liveStatus : frozen.status;

  function close() {
    props.onOpenChange?.(false);
    setQuery("");
    setPlayersOutcome(null);
    setClansOutcome(null);
    setTanksOutcome(null);
    setMapsOutcome(null);
  }

  function pickRow(row: SelectableRow) {
    close();
    if (row.type === "player") {
      addRecent(rowToItem(row));
      router.push(ROUTES.PLAYER(row.region, row.player.nickname));
    } else if (row.type === "clan") {
      addRecent(rowToItem(row));
      router.push(ROUTES.CLAN(row.region, row.clan.tag));
    } else if (row.type === "tank") {
      addRecent(rowToItem(row));
      router.push(ROUTES.TANK(row.region, row.tank.slug));
    } else {
      addRecent(rowToItem(row));
      router.push(ROUTES.MAP(row.region, row.map.slug));
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
              placeholder="Search players, clans, tanks or maps"
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
