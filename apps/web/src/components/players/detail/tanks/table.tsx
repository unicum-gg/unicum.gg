"use client";

import { useFormat } from "@/hooks/use-format";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_TANK_BATTLE_MODE,
  isRatedTankMode,
  type PlayerTankRow,
  type TankBattleMode,
} from "@unicum.gg/shared";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import { Table, TableBody } from "@/components/ui/table";
import {
  PLAYER_COLUMNS,
  PLAYER_RANGE_COLUMNS,
  PlayerColumnSelector,
  type PlayerCellCtx,
  type PlayerSortCtx,
  COMPACT_COLUMN_KEYS,
  RATING_COLUMN_KEY,
  usePlayerColumns,
} from "@/components/players/detail/tanks/vehicle-columns";
import {
  MarkTargetSelect,
  useMarkTarget,
} from "@/components/players/detail/tanks/mark-target-select";
import { PlayerTanksTableHead } from "@/components/players/detail/tanks/table-head";
import { PlayerTankTableRow } from "@/components/players/detail/tanks/table-row";
import { compareRows } from "@/components/players/detail/tanks/table-sort";
import { TablePager, usePagination } from "@/components/table-pager";
import { TankFilterBar } from "@/components/tanks/tank-filter-bar";
import {
  GarageState,
  type RangeColumn,
  useTankFilters,
} from "@/hooks/use-tank-filters";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Region } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";
import { FilterSubject } from "@/components/filter-subject";
import { SortDirection, type SortState } from "@/components/tanks/sortable-head";

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
  const { t } = useTranslation("components/players/detail/tanks/table");
  // The columns are module constants, so the strings their cells render come
  // from here rather than from a hook of their own.
  const { t: tCols } = useTranslation(
    "components/players/detail/tanks/vehicle-columns",
  );
  // Per vehicle, so WN only: a PR or WTR reader reads WNX (see
  // `RatingMetric`).
  const { wnMetric: metric } = useRatingMetric();
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
  const cellCtx: PlayerCellCtx = useMemo(
    () => ({ region, metric, markTarget, num, t: tCols }),
    [region, metric, markTarget, num, tCols],
  );

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
            <PlayerTanksTableHead
              sort={sort}
              onToggle={toggleSort}
              columns={visibleColumns}
              sortCtx={sortCtx}
            />
            <TableBody>
              {paged.map((r) => {
                const selected = selectedSlug != null && r.slug === selectedSlug;
                return (
                  <PlayerTankTableRow
                    key={r.tankId}
                    row={r}
                    region={region}
                    nickname={nickname}
                    mode={mode}
                    selected={selected}
                    selectedRef={selected ? selectedRowRef : undefined}
                    columns={visibleColumns}
                    cellCtx={cellCtx}
                  />
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
