"use client";

import { useFormat } from "@/hooks/use-format";
import { statLabel } from "@/components/stat-label";

import Link from "@/components/link";
import { useRouter } from "@/hooks/use-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toRoman } from "roman-numerals";
import ROUTES from "@/constants/routes";
import {
  DEFAULT_RATING_METRIC,
  DEFAULT_TANK_BATTLE_MODE,
  isRatedTankMode,
  isRatingMetric,
  RatingMetric,
  type PlayerTankRow,
  type TankBattleMode,
} from "@unicum.gg/shared";
import { withTankMode } from "@/hooks/use-tank-mode";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NationFlag } from "@/components/tanks/nation-flag";
import {
  PLAYER_COLUMNS,
  PLAYER_COLUMN_BY_KEY,
  PLAYER_RANGE_COLUMNS,
  PlayerColumnSelector,
  type PlayerSortCtx,
  COMPACT_COLUMN_KEYS,
  RATING_COLUMN_KEY,
  usePlayerColumns,
} from "@/components/players/detail/tanks/vehicle-columns";
import {
  MarkTargetSelect,
  useMarkTarget,
} from "@/components/players/detail/tanks/mark-target-select";
import { TankIcon } from "@/components/tanks/tank-icon";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { TablePager, usePagination } from "@/components/table-pager";
import { TankFilterBar } from "@/components/tanks/tank-filter-bar";
import {
  GarageState,
  type RangeColumn,
  useTankFilters,
} from "@/hooks/use-tank-filters";
import { GarageBadge } from "@/components/players/detail/tanks/garage-badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";
import { useStatLabels } from "@/hooks/use-stat-labels";
import { FilterSubject } from "@/components/filter-subject";
import {
  SortDirection,
  SortableHead,
  type SortState,
} from "@/components/tanks/sortable-head";

const TYPE_ABBR: Record<string, string> = {
  heavyTank: "HT",
  mediumTank: "MT",
  lightTank: "LT",
  "AT-SPG": "TD",
  SPG: "SPG",
};

function sortValue(
  row: PlayerTankRow,
  key: string,
  ctx: PlayerSortCtx,
): number | string {
  switch (key) {
    case "nation":
      return row.nation ?? "";
    case "type":
      return TYPE_ABBR[row.type ?? ""] ?? row.type ?? "";
    case "tier":
      return row.tier ?? 0;
    case "name":
      return row.name.toLowerCase();
    default:
      return PLAYER_COLUMN_BY_KEY[key]?.sortValue(row, ctx) ?? -1;
  }
}

function compareRows(
  a: PlayerTankRow,
  b: PlayerTankRow,
  state: SortState,
  ctx: PlayerSortCtx,
): number {
  // Default: most battles first.
  if (!state) return b.battles - a.battles;
  const mul = state.direction === SortDirection.Asc ? 1 : -1;
  const av = sortValue(a, state.key, ctx);
  const bv = sortValue(b, state.key, ctx);
  if (typeof av === "string" && typeof bv === "string") {
    return mul * av.localeCompare(bv);
  }
  return mul * ((av as number) - (bv as number));
}

export function PlayerTanksTable({
  region,
  nickname,
  vehicles,
  selectedSlug,
  mode = DEFAULT_TANK_BATTLE_MODE,
}: {
  region: Region;
  nickname: string;
  vehicles: PlayerTankRow[];
  /** The vehicle whose record is open beside the table, highlighted here so the
   * two halves agree on what is being read. */
  selectedSlug?: string | null;
  /** The battle mode these rows describe. Three things read it: an empty list
   * means something different under a mode (a player with 215 vehicles and no
   * Skirmish among them has not "played no tanks yet"), the WN column comes off
   * outside Random (`TANK_MODES_RATED`), and every row carries it onto the
   * record it opens so the panel lands on the same mode. */
  mode?: TankBattleMode;
}) {
  const { num } = useFormat();
  const { t: tStats } = useStatLabels();
  const { t } = useTranslation("components/players/detail/tanks/table");
  const { t: tTable } = useTranslation("components/tanks/table");
  // The columns are module constants, so the strings their cells render come
  // from here rather than from a hook of their own.
  const { t: tCols } = useTranslation(
    "components/players/detail/tanks/vehicle-columns",
  );
  const router = useRouter();
  const [storedRating] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;
  const [sort, setSort] = useState<SortState>({
    key: "battles",
    direction: SortDirection.Desc,
  });
  const { target: markTarget, pinned: markPinned } = useMarkTarget();
  const sortCtx: PlayerSortCtx = useMemo(
    () => ({ metric, markTarget }),
    [metric, markTarget],
  );
  // A link that names a mark is asking "which of these could I take there", so
  // the table opens on that answer rather than on the battle count. Once only,
  // like the filters' own seed from the URL: re-applying it would undo the
  // reader's next column click, and changing the target afterwards is a change
  // of bar rather than a new question.
  const seededSort = useRef(false);
  useEffect(() => {
    if (seededSort.current || !markPinned) return;
    seededSort.current = true;
    setSort({ key: "markReach", direction: SortDirection.Desc });
  }, [markPinned]);
  const rated = isRatedTankMode(mode);
  const filteredByMode = mode !== DEFAULT_TANK_BATTLE_MODE;
  // A reader who sorted by rating and then picked a mode would be left sorting
  // on a column that is gone and holds nothing. The stored sort is untouched,
  // so going back to Random restores it. Memoized because the fallback is a
  // fresh object and the sort below lists it as a dependency: rebuilt every
  // render, it would re-sort up to 655 rows on every keystroke in the filters.
  const effectiveSort = useMemo(
    () =>
      !rated && sort?.key === RATING_COLUMN_KEY
        ? { key: "battles", direction: SortDirection.Desc }
        : sort,
    [rated, sort],
  );
  const [visibleKeys] = usePlayerColumns();

  // Numeric columns the min/max range filter can target, taken from the columns
  // themselves so a new one arrives in the filter the day it is added rather
  // than whenever somebody notices. Labels follow the same headings as the
  // table, which is what makes the two name the same thing: both the rating and
  // the mark column rename themselves after the reader's own choice.
  const rangeCols: RangeColumn<PlayerTankRow>[] = useMemo(
    () =>
      PLAYER_RANGE_COLUMNS
        // Dropped outside Random: a min/max over a column of nulls filters
        // everything out the moment anybody touches it.
        .filter((c) => rated || c.key !== RATING_COLUMN_KEY)
        .map((c) => ({
          key: c.key,
          label: c.header ? c.header(sortCtx) : c.label,
          value: (r: PlayerTankRow) => c.rangeValue(r, sortCtx),
        })),
    [sortCtx, rated],
  );

  // The filter hook names these for what they hold, since the tank catalogue
  // already uses `moe`/`mom` for the region's thresholds. Mapped rather than
  // renamed on the row, so the rest of the table keeps reading `moe`/`mom`.
  const filterable = useMemo(
    () =>
      vehicles.map((v) => ({
        ...v,
        gunMarks: v.moe,
        masteryBadge: v.mom,
        // Null on an unverified profile, where `owned` is null on every row and
        // the site cannot tell a sold vehicle from a held one. The chip row and
        // the badges hide themselves on that, rather than guessing.
        garageState:
          v.owned == null
            ? null
            : v.owned === false
              ? GarageState.Sold
              : v.battles === 0
                ? GarageState.Unplayed
                : GarageState.Held,
      })),
    [vehicles],
  );
  const hasMarkReach = useMemo(
    () => vehicles.some((v) => v.markReach != null),
    [vehicles],
  );
  const { filtered, filters } = useTankFilters(filterable, rangeCols, "battles");
  // Picking a mode outside Random takes the WN column away, and with it the
  // range column a reader may have bounds set on. `resetRange` puts the
  // selector and the bounds back on a column that still exists, so the filter
  // cannot keep narrowing the list under a name that has gone.
  const rangeColKey = filters.rangeCol;
  const resetRange = filters.resetRange;
  useEffect(() => {
    if (!rated && rangeColKey === RATING_COLUMN_KEY) resetRange("battles");
  }, [rated, rangeColKey, resetRange]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareRows(a, b, effectiveSort, sortCtx)),
    [filtered, effectiveSort, sortCtx],
  );
  const { paged, pager } = usePagination(sorted);

  // Bring the open record's row to the reader rather than making them hunt for
  // it. Two steps, because the list is paginated: the tank someone shared a
  // link to is often not on page 1 at all.
  const selectedIndex = useMemo(
    () =>
      selectedSlug ? sorted.findIndex((r) => r.slug === selectedSlug) : -1,
    [sorted, selectedSlug],
  );
  // Only when the selection itself changes, so paging away from the open
  // record afterwards is not undone on the next render.
  const [pagedFor, setPagedFor] = useState<string | null>(null);
  if (selectedSlug && selectedSlug !== pagedFor) {
    setPagedFor(selectedSlug);
    if (selectedIndex >= 0 && pager.pageSize !== "all") {
      const wanted = Math.floor(selectedIndex / pager.pageSize) + 1;
      if (wanted !== pager.page) pager.setPage(wanted);
    }
  }

  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    // `nearest`: a row already on screen (the one just clicked) does not move,
    // and one arrived at by link is scrolled just far enough to be read.
    selectedRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedSlug, pager.page]);
  // Beside an open record the list has a third less width, so it shows the
  // game's own columns and lets the record carry the rest.
  const visibleColumns = useMemo(
    () =>
      PLAYER_COLUMNS.filter(
        (c) =>
          // A reader who asked for a mark asked for the column that answers
          // it, whether or not their stored columns hold it: the set is a
          // cookie, so everybody who had ever touched it would otherwise
          // follow a link from the marks panel to a table with no mark column.
          (visibleKeys.has(c.key) || (markPinned && c.key === "markReach")) &&
          (rated || c.key !== RATING_COLUMN_KEY) &&
          (!selectedSlug || COMPACT_COLUMN_KEYS.has(c.key)),
      ),
    [visibleKeys, selectedSlug, markPinned, rated],
  );

  const showsMarkColumn = visibleColumns.some((c) => c.key === "markReach");

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: SortDirection.Desc };
      if (prev.direction === SortDirection.Desc)
        return { key, direction: SortDirection.Asc };
      return null;
    });
  }

  if (vehicles.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t(filteredByMode ? "no-tanks-played-in-this-mode" : "no-tanks-played-yet")}
      </p>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-4">
        <TankFilterBar
          filters={filters}
          searchNoun={FilterSubject.Tanks}
          // Hidden while a record is open: the columns are imposed then, and a
          // picker that answers "7 of 7" over a four-column table is a lie.
          extra={
            selectedSlug ? undefined : (
              <>
                {/* Only where it has something to act on. Two ways it can
                    have nothing: a garage with no mark bars anywhere (every
                    vehicle under tier 5, or a region whose bars failed to
                    load), and a reader whose stored columns leave the mark
                    column out, where the control would change a column that is
                    not on the table. */}
                {hasMarkReach && showsMarkColumn && <MarkTargetSelect />}
                <PlayerColumnSelector rated={rated} />
              </>
            )
          }
        />
      </div>
      <div className="border-t border-fd-border">
        {sorted.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t("no-tanks-match-these-filters")}</p>
        ) : (
          <>
          {/* `rail`: the five columns a phone keeps still come to more than its
              width, and the vehicle names are deliberately never wrapped, so
              the list is read by scrolling sideways and needs to say so. */}
          <Table
            rail
            className="my-0! [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-3! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-3!"
          >
            <TableHeader>
              <TableRow>
                <SortableHead
                  col="nation"
                  state={sort}
                  onToggle={toggleSort}
                  align="center"
                  hideOnMobile
                  headClassName="w-px"
                  tooltip={tTable("nation")}
                >
                  <TankopediaHeaderIcon name="nation" />
                </SortableHead>
                <SortableHead
                  col="type"
                  state={sort}
                  onToggle={toggleSort}
                  align="center"
                  hideOnMobile
                  headClassName="w-px"
                  tooltip={tTable("type")}
                >
                  <TankopediaHeaderIcon name="type" />
                </SortableHead>
                <SortableHead
                  col="tier"
                  state={sort}
                  onToggle={toggleSort}
                  align="center"
                  hideOnMobile
                  headClassName="w-px"
                  tooltip={tTable("tier")}
                >
                  <span className="whitespace-nowrap text-xs font-medium tracking-tight text-fd-muted-foreground">
                    I-XI
                  </span>
                </SortableHead>
                <SortableHead col="name" state={sort} onToggle={toggleSort}>
                  {t("name")}</SortableHead>
                {visibleColumns.map((c) => (
                  <SortableHead
                    key={c.key}
                    col={c.key}
                    state={sort}
                    onToggle={toggleSort}
                    align={c.align}
                    hideOnMobile={c.hideOnMobile}
                    tooltip={statLabel(c.tip, tStats)}
                  >
                    {statLabel(c.header ? c.header(sortCtx) : c.label, tStats)}
                  </SortableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r) => {
                const hasIcon = !!(r.tag && r.type);
                const name = r.shortName || r.name || `#${r.tankId}`;
                const isPremium = r.isPremium;
                const selected = selectedSlug != null && r.slug === selectedSlug;
                // A vehicle owned and never driven has no record to open: the
                // record is built from a per-tank snapshot, and Wargaming
                // publishes none for a tank that has never been in a battle, so
                // that URL is a genuine 404 rather than a page we forgot to
                // write. The row still has somewhere to go, and it is the
                // vehicle's own page, which is the only one with anything to
                // say about a tank you own and have not played.
                const unplayed = r.garageState === GarageState.Unplayed;
                const href = !r.slug
                  ? null
                  : unplayed
                    ? ROUTES.TANK(region, r.slug)
                    : // In the mode the row is being read in, so a record
                      // opened from a Skirmish list opens on Skirmish. The
                      // vehicle's own page above is not a per-mode view, so it
                      // carries nothing.
                      withTankMode(
                        ROUTES.PLAYER_TANK(region, nickname, r.slug),
                        mode,
                      );
                return (
                  <TableRow
                    key={r.tankId}
                    ref={selected ? selectedRowRef : undefined}
                    // The row opens this player's record on the tank, which
                    // is a URL of its own. The name inside is a real link to
                    // the same place, so the destination does not depend on
                    // where in the row the reader clicked.
                    onClick={() => {
                      if (!href) return;
                      // `scroll: false` for the record, which opens beside the
                      // row: the reader is picking a row half way down 157 of
                      // them, and jumping to the top of the page would take
                      // both the row and the record they just asked for off
                      // screen. An unplayed row leaves this page entirely, so
                      // it keeps the normal scroll-to-top.
                      router.push(href, unplayed ? undefined : { scroll: false });
                    }}
                    className={cn(
                      href && "cursor-pointer",
                      // A left edge rather than a row tint: the rating columns
                      // paint their own cells, so a background would show
                      // through on some columns and not others.
                      selected &&
                        "bg-fd-secondary/40 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-brand",
                    )}
                  >
                    <TableCell className={cn("text-center", styles.hiddenColumn)}>
                      {r.nation ? (
                        <NationFlag nation={r.nation} region={region} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={cn("text-center", styles.hiddenColumn)}>
                      {r.type ? (
                        <VehicleTypeIcon type={r.type} premium={isPremium} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center font-medium",
                        styles.hiddenColumn,
                        isPremium && "text-[#FAB81B]",
                      )}
                    >
                      {r.tier ? toRoman(r.tier) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        // Never wrapped: a name folding onto three lines is
                        // what makes a narrowed table look broken, and the
                        // container scrolls when it has to.
                        "font-medium whitespace-nowrap max-sm:pl-4!",
                        isPremium && "text-[#FAB81B]",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {hasIcon ? (
                          <TankIcon
                            region={region}
                            tag={r.tag!}
                            type={r.type!}
                            className="h-3.5 w-auto shrink-0 object-contain"
                          />
                        ) : null}
                        {href ? (
                          <Link
                            // Same destination as the row around it, whichever
                            // of the two it is. Sending the name somewhere else
                            // made one row answer two ways depending on where
                            // it was clicked, which reads as a broken link
                            // rather than as a second destination.
                            href={href}
                            scroll={unplayed ? undefined : false}
                            className="hover:underline"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span>{name}</span>
                        )}
                        <GarageBadge state={r.garageState} />
                      </span>
                    </TableCell>
                    {visibleColumns.map((c) => {
                      const { node, className } = c.cell(r, {
                        region,
                        metric,
                        markTarget,
                        num,
                        t: tCols,
                      });
                      return (
                        <TableCell
                          key={c.key}
                          className={cn(
                            "tabular-nums",
                            c.align === "center" && "text-center",
                            c.align === "end" && "text-right",
                            c.hideOnMobile && styles.hiddenColumn,
                            className,
                          )}
                        >
                          {node}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePager pager={pager} />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
