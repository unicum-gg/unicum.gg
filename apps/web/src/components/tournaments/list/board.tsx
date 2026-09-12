"use client";

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { StarIcon } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "@/components/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tierBand } from "@/components/tournaments/tier-label";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { TournamentFacetBar } from "./facet-bar";
import { useTournamentFacets } from "./facets";
import { SegmentedControl } from "@/components/segmented-control";
import { TablePager, usePagination } from "@/components/table-pager";
import {
  nextSort,
  readSortFromUrl,
  SortHead,
  writeSortToUrl,
} from "@/components/tournaments/sort-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ROUTES from "@/constants/routes";
import { TournamentStatusBadge } from "@/components/tournaments/status-badge";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  isTournamentLive,
  isTournamentOpen,
  teamFormat,
} from "@unicum.gg/shared";
import {
  REGION_LABEL,
  TournamentStatus,
  type Region,
  type TournamentGameMode,
} from "@unicum.gg/wargaming";
import {
  compareTournaments,
  isTournamentSortColumn,
  TournamentSortColumn,
  type TournamentSortState,
} from "./sorting";
import { FilterSubject } from "@/components/filter-subject";

/** The band as this table shows it: the numeral, or its own placeholder. */
const tierBandOrDash = (from: number | null, to: number | null) =>
  tierBand(from, to) ?? DASH;

const DASH = "—";

const DATE_PATTERN = "d MMM yyyy" /* UTC */;

export type TournamentListRow = {
  id: number;
  title: string;
  status: TournamentStatus;
  gameModes: TournamentGameMode[];
  tierFrom: number | null;
  tierTo: number | null;
  minPlayersInTeam: number;
  maxPlayersInTeam: number;
  confirmedTeams: number;
  startAt: Date;
  registrationTill: Date | null;
  prize: string | null;
  /** Wargaming's own editorial flag: the championships and series, as against
   * the automated dailies. */
  isFeatured: boolean;
  /** The organiser's logo. Asia holds a handful of values that are not URLs, so
   * callers test for `http` rather than for null. */
  logoUrl: string | null;
};

/** Which slice a reader is looking at. Open and settled are the two real
 * questions ("can I still enter" / "what happened"), so they are the tabs. */
export enum TournamentFilter {
  Open = "open",
  Completed = "completed",
  All = "all",
}

const FILTERS = [
  { id: TournamentFilter.Open, label: "Open & live" },
  { id: TournamentFilter.Completed, label: "Completed" },
  { id: TournamentFilter.All, label: "All" },
];

const DEFAULT_FILTER = TournamentFilter.Open;

function isFilter(value: string): value is TournamentFilter {
  return (Object.values(TournamentFilter) as string[]).includes(value);
}

function matches(row: TournamentListRow, filter: TournamentFilter): boolean {
  if (filter === TournamentFilter.All) return true;
  if (filter === TournamentFilter.Completed) {
    return row.status === TournamentStatus.Complete;
  }
  return isTournamentOpen(row.status) || isTournamentLive(row.status);
}

/** Which tab is showing, as `?show=`, so a shared link opens on the same slice.
 * The default writes nothing, keeping the plain catalogue URL clean. */
function writeFilterToUrl(filter: TournamentFilter): void {
  const params = new URLSearchParams(window.location.search);
  if (filter === DEFAULT_FILTER) params.delete("show");
  else params.set("show", filter);
  const qs = params.toString();
  window.history.replaceState(
    null,
    "",
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
}

/**
 * The tournament catalogue for a region.
 *
 * Filtered and sorted client-side over the slice the server handed down rather
 * than by refetching: the endpoint returns the whole set in one read, and every
 * control here is a view of it, not another dataset.
 */
export function TournamentsBoard({
  region,
  rows,
}: {
  region: Region;
  rows: TournamentListRow[];
}) {
  const { date } = useFormat();
  const { t } = useTranslation("components/tournaments/list/board");
  const { t: tGame } = useTranslation("game/vocabulary");
  const [filter, setFilter] = useState(DEFAULT_FILTER);
  const [sort, setSort] = useState<TournamentSortState>(null);

  // Memoized because `usePagination` treats a new array identity as a new list
  // and resets its page DURING render, so an inline `.filter()` would hand it a
  // fresh array every time and loop. Changing the tab SHOULD reset the page,
  // and depending on it here is what makes that happen exactly once.
  const visible = useMemo(
    () => rows.filter((r) => matches(r, filter)),
    [rows, filter],
  );

  // Facets before search: the tab picks the era, the chips pick the kind, and
  // the search narrows what is left. Each stage hands the next a smaller list,
  // which is also the order the controls read down the page.
  const { facets, filtered: byFacet } = useTournamentFacets(visible);

  const searchFields = useCallback(
    (r: TournamentListRow) => [
      r.title,
      r.prize,
      ...r.gameModes.map((m) => tGame(`tournament-modes.${m}`)),
    ],
    [tGame],
  );
  const rangeCols = useMemo<RangeColumn<TournamentListRow>[]>(
    () => [
      { key: "teams", label: "Teams", value: (r) => r.confirmedTeams },
      { key: "tier", label: "Tier", value: (r) => r.tierFrom ?? r.tierTo },
      {
        key: "format",
        label: "Team size",
        value: (r) => r.minPlayersInTeam,
      },
    ],
    [],
  );
  const { filtered, filters } = useLeaderboardFilter(byFacet, {
    searchFields,
    rangeCols,
    initialRangeCol: "teams",
    syncUrl: true,
  });

  const ordered = useMemo(
    () => filtered.slice().sort((a, b) => compareTournaments(a, b, sort)),
    [filtered, sort],
  );
  const { paged, pager } = usePagination(ordered, 50);

  // Adopt `?show=` / `?sort=` deep links once on mount. Client-only, since the
  // page is static and `window.location` is not readable while rendering it.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const params = new URLSearchParams(window.location.search);
    const show = params.get("show");
    /* eslint-disable react-hooks/set-state-in-effect -- deep links are only readable client-side after mount (the page is static) */
    if (show && isFilter(show)) setFilter(show);
    const fromUrl = readSortFromUrl(
      window.location.search,
      isTournamentSortColumn,
    );
    if (fromUrl) setSort(fromUrl);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [, tGame]);

  function changeFilter(next: TournamentFilter) {
    setFilter(next);
    writeFilterToUrl(next);
  }

  function toggleSort(column: TournamentSortColumn) {
    setSort((prev) => {
      const next = nextSort(prev, column);
      writeSortToUrl(next);
      return next;
    });
  }

  return (
    <Panel>
      <PanelHeader
        screenLines={false}
        className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border"
      >
        <PanelTitle>
          {t("region-tournaments", {
            region: REGION_LABEL[region],
            count: visible.length,
          })}
        </PanelTitle>
        <SegmentedControl
          segments={FILTERS}
          active={filter}
          onSelect={changeFilter}
        />
      </PanelHeader>
      <PanelContent className="p-0">
        {visible.length === 0 ? (
          <p className={cn(styles.mutedDescription, "p-4")}>
            {t("nothing-here-right-now-wargaming")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 border-b border-fd-border px-4 py-2.5">
              <LeaderboardFilterBar filters={filters} searchNoun={FilterSubject.Tournaments} />
              <TournamentFacetBar facets={facets} />
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                {t("no-tournament-matches-the-current")}</div>
            ) : (
              <Table
                className={cn(
                  // Fixed, like the leaderboards: the title column then takes
                  // whatever is left and truncates, instead of growing until it
                  // pushed the status badge onto a second line and made every
                  // row a different height.
                  "my-0! table-fixed",
                  "[&_td]:min-w-0 [&_td]:py-1.5! [&_th]:py-2!",
                  "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
                  "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
                  "[&_thead_th:first-child>button]:pl-4!",
                )}
              >
                <TableHeader>
                  <TableRow>
                    <SortHead
                      column={TournamentSortColumn.Date}
                      state={sort}
                      onToggle={toggleSort}
                      className="w-32 whitespace-nowrap"
                    >
                      {t("date")}</SortHead>
                    <SortHead
                      column={TournamentSortColumn.Title}
                      state={sort}
                      onToggle={toggleSort}
                    >
                      {t("tournament")}</SortHead>
                    <TableHead className="w-40">{t("status")}</TableHead>
                    <TableHead className="hidden w-32 whitespace-nowrap md:table-cell">
                      {t("mode")}</TableHead>
                    <SortHead
                      column={TournamentSortColumn.Tier}
                      state={sort}
                      onToggle={toggleSort}
                      className="w-20 text-end!"
                    >
                      {t("tier")}</SortHead>
                    <SortHead
                      column={TournamentSortColumn.Format}
                      state={sort}
                      onToggle={toggleSort}
                      className="w-24 text-end! whitespace-nowrap"
                    >
                      {t("format")}</SortHead>
                    <SortHead
                      column={TournamentSortColumn.Teams}
                      state={sort}
                      onToggle={toggleSort}
                      className="w-24 text-end!"
                    >
                      {t("teams")}</SortHead>
                    <TableHead className="hidden w-28 lg:table-cell">{t("prize")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-fd-muted-foreground tabular-nums">
                        {date(DATE_PATTERN).format(r.startAt)}
                      </TableCell>
                      <TableCell className="truncate">
                        {/* The organiser's logo, which is what tells two
                            identically-named dailies apart at a glance and gives
                            the branded series their identity. */}
                        {r.logoUrl?.startsWith("http") && (
                          <Image
                            src={r.logoUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="mr-1.5 inline size-5 align-[-4px] object-contain"
                          />
                        )}
                        {/* Wargaming's own editorial flag, the only thing
                            separating a championship paying cash from the 51st
                            daily 1v1. */}
                        {r.isFeatured && (
                          <StarIcon
                            weight="fill"
                            className="mr-1.5 inline size-3.5 align-[-2px] text-amber-500"
                            aria-label={t("featured-tournament")}
                          />
                        )}
                        <Link
                          href={ROUTES.TOURNAMENT(region, r.id)}
                          className="font-medium hover:underline"
                          title={r.title}
                        >
                          {r.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <TournamentStatusBadge status={r.status} settled />
                      </TableCell>
                      <TableCell className="hidden truncate text-fd-muted-foreground md:table-cell">
                        {r.gameModes
                          .map((m) => tGame(`tournament-modes.${m}`))
                          .join(", ") || DASH}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {tierBandOrDash(r.tierFrom, r.tierTo)}
                      </TableCell>
                      <TableCell className="text-end whitespace-nowrap tabular-nums">
                        {teamFormat(r.minPlayersInTeam)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {r.confirmedTeams}
                      </TableCell>
                      <TableCell className="hidden truncate text-fd-muted-foreground lg:table-cell">
                        {r.prize ?? DASH}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {pager.total > 0 && <TablePager pager={pager} />}
          </>
        )}
      </PanelContent>
    </Panel>
  );
}
