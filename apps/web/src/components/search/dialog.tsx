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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterBar, SearchType } from "@/components/search/filter-bar";
import { ResultsArea } from "@/components/search/results-area";
import {
  type ResultsStatus,
  type Row,
  type SelectableRow,
  flattenHistory,
  flattenSections,
  rowToItem,
  selectableRows,
} from "@/components/search/row-model";
import { useSearchResults } from "@/components/search/use-search-results";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { useSearchHistory } from "@/hooks/use-search-history";
import { startNavigationProgress } from "@/components/navigation-progress";
import { cn } from "@/lib/utils";
import {
  isRegion,
  Region,
  regionFromPathname,
} from "@unicum.gg/wargaming";

const MIN_QUERY_LENGTH = 3;

/** Destination of a result row. Shared by the prefetch and the navigation, so
 * the two can never warm and then open different URLs. */
function hrefForRow(row: SelectableRow): string {
  if (row.type === "player")
    return ROUTES.PLAYER(row.region, row.player.nickname);
  if (row.type === "clan") return ROUTES.CLAN(row.region, row.clan.tag);
  if (row.type === "tank") return ROUTES.TANK(row.region, row.tank.slug);
  if (row.type === "glossary") return ROUTES.GLOSSARY_TERM(row.term.slug);
  return ROUTES.MAP(row.region, row.map.slug);
}

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
  const [activeIndex, setActiveIndex] = useState(0);
  const {
    recent,
    favorites,
    addRecent,
    removeRecent,
    toggleFavorite,
    isFavorite,
    refresh: refreshHistory,
  } = useSearchHistory();

  // The saved entries store the row they were pinned from, which ages: a
  // favorited player changes clan, a clan renames. Ask for the current rows
  // whenever the dialog opens, before the reader has read the list. Throttled
  // inside the hook, so reopening it five times costs one call.
  useEffect(() => {
    if (props.open) void refreshHistory();
  }, [props.open, refreshHistory]);

  const trimmedQuery = query.trim();
  const onFirstResults = useCallback(() => setActiveIndex(0), []);
  const { sections, anyLoading, allErrored, allEmpty, reset } = useSearchResults(
    {
      region,
      searchType,
      trimmedQuery,
      minQueryLength: MIN_QUERY_LENGTH,
      onFirstResults,
    },
  );

  // When the input is empty, show the user's recent + favorite items
  // instead of a blank state. The search results take over the moment
  // they start typing.
  const queryIsEmpty = trimmedQuery.length < MIN_QUERY_LENGTH;
  const historyRows = useMemo(
    () => (queryIsEmpty ? flattenHistory(recent, favorites) : []),
    [queryIsEmpty, recent, favorites],
  );
  const searchRows = useMemo(
    () => flattenSections(region, sections),
    [region, sections],
  );
  const rows = queryIsEmpty ? historyRows : searchRows;
  const selectable = useMemo(() => selectableRows(rows), [rows]);

  // Warm the highlighted result. Result rows are buttons, so they get none of
  // the automatic <Link> prefetching, and picking one used to pay the full RSC
  // round-trip on click. The highlight follows both the arrow keys and the
  // mouse, so this covers either way of choosing a row.
  const active = selectable[activeIndex];
  const activeHref = active ? hrefForRow(active) : null;
  useEffect(() => {
    if (activeHref) router.prefetch(activeHref);
  }, [activeHref, router]);

  const hasAnyVisible = rows.length > 0;
  const showArea = hasAnyVisible || anyLoading || allErrored || allEmpty;

  // Freeze content during the close animation so the dialog doesn't flash empty
  // before unmounting: keep the last-painted rows + status and refresh them
  // while it is open. Uses React's "value from a previous render" pattern
  // (conditional set-state during render) rather than a ref read during render
  // or a state update from an effect.
  //
  // Keyed on the dialog being open, not on there being something to show. Those
  // came apart when the list legitimately emptied under an open dialog (removing
  // the last favorite): `showArea` went false, the frozen copy took over, and
  // the removed row stayed in the DOM, invisible only because the area collapses
  // to nothing, yet still focusable and still openable with the keyboard.
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
    props.open &&
    (frozen.rows !== rows ||
      frozen.status.anyLoading !== anyLoading ||
      frozen.status.allErrored !== allErrored ||
      frozen.status.allEmpty !== allEmpty ||
      frozen.status.hasAnyVisible !== hasAnyVisible)
  ) {
    setFrozen({ rows, status: liveStatus });
  }

  const renderRows = props.open ? rows : frozen.rows;
  const renderStatus: ResultsStatus = props.open ? liveStatus : frozen.status;

  function close() {
    props.onOpenChange?.(false);
    setQuery("");
    reset();
  }

  function pickRow(row: SelectableRow) {
    close();
    addRecent(rowToItem(row));
    // Results are buttons, not links, so nothing lights the global progress bar
    // on its own (Next only calls pushState once the payload has landed).
    startNavigationProgress();
    router.push(hrefForRow(row));
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
              placeholder="Search players, clans, tanks, maps or terms"
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
