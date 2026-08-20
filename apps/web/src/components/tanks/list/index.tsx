"use client";

import { useMemo } from "react";
import {
  PERF_COLUMNS,
  PerfColumnSelector,
} from "@/components/tanks/perf-columns";
import { TankFilterBar } from "@/components/tanks/tank-filter-bar";
import { type RangeColumn, useTankFilters } from "@/hooks/use-tank-filters";
import {
  EconColumnSelector,
  TanksEconTable,
} from "@/components/tanks/list/economics";
import {
  MasteryColumnSelector,
  TanksMasteryTable,
} from "@/components/tanks/list/marks-of-mastery";
import {
  MoeColumnSelector,
  TanksMoeTable,
} from "@/components/tanks/list/marks-of-excellence";
import { SPEC_COLUMNS } from "@/components/tanks/list/spec-columns";
import { TankTab } from "@/components/tanks/list/tabs";
import { TanksTabNav } from "@/components/tanks/list/tab-nav";
import {
  SpecColumnSelector,
  TanksSpecsTable,
} from "@/components/tanks/list/specifications";
import { TanksTable } from "@/components/tanks/list/performances";
import { Panel, PanelContent } from "@/components/panel";
import { TankCompareBar } from "@/components/tanks/list/compare-bar";
import { useTankSelection } from "@/hooks/use-compare-selection";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RatingMetric,
} from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import useSWR from "swr";
import { TableSkeleton, type SkeletonColumn } from "@/components/table-skeleton";
import {
  groupForTab,
  type TankListItem,
} from "@/components/tanks/list/build";
import { groupKey, loadGroup } from "@/components/tanks/list/load-group";

// The row types + builders live in the framework-free `./build` (shared with the
// server page); re-exported here so existing importers of these types keep
// working.
export type {
  TankStatsRow,
  TankListItem,
  MasteryRow,
  MoeRow,
} from "@/components/tanks/list/build";

const ECON_RANGE_COLS: RangeColumn<TankListItem>[] = [
  { key: "buyCredits", label: "Cost (credits)", value: (t) => t.specs?.buyCredits ?? null },
  { key: "buyGold", label: "Cost (gold)", value: (t) => t.specs?.buyGold ?? null },
  { key: "researchXp", label: "Research XP", value: (t) => t.specs?.researchXp ?? null },
  { key: "shellCost", label: "Shell cost", value: (t) => t.specs?.shellCost ?? null },
  { key: "ammoCost", label: "Full ammo cost", value: (t) => t.specs?.ammoCost ?? null },
];
const MASTERY_RANGE_COLS: RangeColumn<TankListItem>[] = [
  { key: "class3", label: "3rd Class", value: (t) => t.mastery?.class3 ?? null },
  { key: "class2", label: "2nd Class", value: (t) => t.mastery?.class2 ?? null },
  { key: "class1", label: "1st Class", value: (t) => t.mastery?.class1 ?? null },
  { key: "ace", label: "Ace Tanker", value: (t) => t.mastery?.ace ?? null },
];
const MOE_RANGE_COLS: RangeColumn<TankListItem>[] = [
  { key: "mark1", label: "1 Mark (65%)", value: (t) => t.moe?.mark1 ?? null },
  { key: "mark2", label: "2 Marks (85%)", value: (t) => t.moe?.mark2 ?? null },
  { key: "mark3", label: "3 Marks (95%)", value: (t) => t.moe?.mark3 ?? null },
];
const RANGE_DEFAULT: Record<TankTab, string> = {
  [TankTab.Performances]: "battles",
  [TankTab.Specifications]: "dpm",
  [TankTab.Economics]: "buyCredits",
  [TankTab.MarksOfExcellence]: "mark3",
  [TankTab.MarksOfMastery]: "ace",
  // Unused: the videos tab has its own panel and never mounts the filter bar.
  [TankTab.Videos]: "battles",
};

// Stable empty reference for a not-yet-loaded tab (keeps useTankFilters memo
// input from changing identity every render).
const EMPTY_ROWS: TankListItem[] = [];

// Placeholder columns while a tab's data loads: 3 tiny icon columns (nation /
// type / tier), a wide name, then numeric stat columns — a rough match of the
// list tables so the swap to real rows doesn't jump.
const LIST_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-6", align: "center" },
  { width: "w-6", align: "center" },
  { width: "w-6", align: "center" },
  { width: "w-28" },
  ...Array.from(
    { length: 7 },
    () => ({ width: "w-12", align: "right" }) as SkeletonColumn,
  ),
];

export function TanksIndex({
  tanks,
  region,
  activeTab,
  basePath,
}: {
  tanks: TankListItem[];
  region: Region;
  activeTab: TankTab;
  basePath: string;
}) {
  // Each tab is a route of its own, so the active one comes from the server and
  // changes through a real navigation. That is what keeps the metadata (title,
  // description, canonical) in step with the page; a `pushState` would leave
  // Next unaware and freeze them on the tab the page was loaded with.
  const tab = activeTab;

  const [storedRating] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const rangeMetric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;

  // Only the active tab's data group ships in the page (`tanks`); the others
  // load on first open. SWR keys on the group's request URL and caches per key,
  // so revisiting a tab is instant and Specifications/Economics (one group)
  // share a single fetch. `items` is undefined while a not-yet-loaded tab
  // fetches → the table area shows a skeleton.
  const currentGroup = groupForTab(tab);
  const seededGroup = groupForTab(activeTab);
  const { data: items } = useSWR(
    groupKey(region, currentGroup),
    () => loadGroup(region, currentGroup),
    {
      fallbackData: currentGroup === seededGroup ? tanks : undefined,
      revalidateOnMount: currentGroup !== seededGroup,
      revalidateIfStale: false,
      revalidateOnFocus: false,
    },
  );
  const rows = items ?? EMPTY_ROWS;

  // Columns the min/max range filter can target, per active tab.
  const rangeCols: RangeColumn<TankListItem>[] = useMemo(() => {
    if (tab === TankTab.Specifications) {
      return SPEC_COLUMNS.map((c) => ({
        key: c.key,
        label: c.label,
        value: (t: TankListItem) => (t.specs ? c.sortValue(t.specs) : null),
      }));
    }
    if (tab === TankTab.Economics) return ECON_RANGE_COLS;
    if (tab === TankTab.MarksOfMastery) return MASTERY_RANGE_COLS;
    if (tab === TankTab.MarksOfExcellence) return MOE_RANGE_COLS;
    return PERF_COLUMNS.map((c) => ({
      key: c.key,
      label: c.header ? c.header(rangeMetric) : c.label,
      value: (t: TankListItem) =>
        t.stats ? c.sortValue(t.stats, rangeMetric) : null,
    }));
  }, [tab, rangeMetric]);

  const { filtered, filters } = useTankFilters(
    rows,
    rangeCols,
    RANGE_DEFAULT[activeTab],
  );

  // Vehicles picked out of the list on their way to a comparison. Held in the
  // query string (see the hook), which is what the tab bar carries across, so a
  // pick made while reading the damage per minute is still there after switching
  // to the mark thresholds.
  const selection = useTankSelection();
  // Chip labels. A slug picked on another tab may not be in this tab's rows yet
  // (its group loads on first open), so the bar falls back to the slug itself
  // rather than dropping the pick.
  const selectedNames = useMemo(() => {
    const wanted = new Set(selection.slugs);
    const names = new Map<string, string>();
    for (const t of rows)
      if (wanted.has(t.slug)) names.set(t.slug, t.shortName || t.name);
    return names;
  }, [rows, selection.slugs]);

  // The href carries the tab alone, so it is what crawlers follow and what Next
  // prefetches. The click adds the current filters (they live in the query
  // string) so switching tab keeps them, then navigates for real.
  return (
    <Panel>
      <TanksTabNav active={tab} basePath={basePath} />
      <PanelContent className="space-y-4 p-4">
        <TankFilterBar
          filters={filters}
          searchNoun="tanks"
          extra={
            <>
              {tab === TankTab.Performances && <PerfColumnSelector />}
              {tab === TankTab.Specifications && <SpecColumnSelector />}
              {tab === TankTab.Economics && <EconColumnSelector />}
              {tab === TankTab.MarksOfMastery && <MasteryColumnSelector />}
              {tab === TankTab.MarksOfExcellence && <MoeColumnSelector />}
            </>
          }
        />
      </PanelContent>
      <div className="border-t border-fd-border">
        {!items ? (
          <TableSkeleton columns={LIST_SKELETON_COLUMNS} rows={14} />
        ) : (
          <>
            {tab === TankTab.Performances && (
              <TanksTable
                region={region}
                rows={filtered}
                selection={selection}
              />
            )}
            {tab === TankTab.Specifications && (
              <TanksSpecsTable
                region={region}
                rows={filtered}
                selection={selection}
              />
            )}
            {tab === TankTab.Economics && (
              <TanksEconTable
                region={region}
                rows={filtered}
                selection={selection}
              />
            )}
            {tab === TankTab.MarksOfMastery && (
              <TanksMasteryTable
                region={region}
                rows={filtered}
                selection={selection}
              />
            )}
            {tab === TankTab.MarksOfExcellence && (
              <TanksMoeTable
                region={region}
                rows={filtered}
                selection={selection}
              />
            )}
          </>
        )}
      </div>
      <TankCompareBar
        region={region}
        selection={selection}
        names={selectedNames}
      />
    </Panel>
  );
}
