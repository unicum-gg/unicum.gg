"use client";

import { useSearchParams } from "next/navigation";
import { type MouseEvent, useMemo, useState } from "react";
import {
  PERF_COLUMNS,
  PerfColumnSelector,
} from "@/components/tanks/perf-columns";
import {
  type RangeColumn,
  TankFilterBar,
  useTankFilters,
} from "@/components/tanks/tank-filter-bar";
import { TanksEconTable } from "@/components/tanks/tanks-econ-table";
import { TanksMasteryTable } from "@/components/tanks/tanks-mastery-table";
import { TanksMoeTable } from "@/components/tanks/tanks-moe-table";
import {
  SPEC_COLUMNS,
  type TankSpecRow,
} from "@/components/tanks/spec-columns";
import {
  TankTab,
  TANK_TABS,
  tankTabHref,
} from "@/components/tanks/tabs";
import {
  SpecColumnSelector,
  TanksSpecsTable,
} from "@/components/tanks/tanks-specs-table";
import { TanksTable } from "@/components/tanks/tanks-table";
import { Panel, PanelContent, PanelHeader } from "@/components/panel";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RatingMetric,
} from "@unicum.gg/core/constants/rating";
import { Region } from "@unicum.gg/wargaming";

export type TankStatsRow = {
  players: number; // number of players in the sample (the "Count" column)
  battles: number | null; // total games played on the tank
  wr: number; // win rate, 0-100
  playerWr: number | null; // avg driver account WR, 0-100
  dpg: number; // avg damage
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  kdr: number | null;
  assists: number | null; // avg assisted damage
  hitPct: number | null; // 0-100
  penPct: number | null; // 0-100
  spots: number | null; // avg spots
  blocked: number | null; // avg blocked damage
  survival: number | null; // 0-100
};

export type TankListItem = {
  tankId: number;
  slug: string;
  name: string;
  shortName: string;
  tag: string;
  tier: number;
  nation: string;
  type: string;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
  stats: TankStatsRow | null;
  specs: TankSpecRow | null;
  mastery: MasteryRow | null;
  moe: MoeRow | null;
};

// XP thresholds for the four Mark of Mastery badges (3rd/2nd/1st/Ace).
export type MasteryRow = {
  class3: number;
  class2: number;
  class1: number;
  ace: number;
};

// Combined-damage thresholds for the three Marks of Excellence (65/85/95%).
export type MoeRow = {
  mark1: number;
  mark2: number;
  mark3: number;
};

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
};

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
  // Tab is client state kept in sync with the URL (?tab=), so switching tabs
  // preserves the shared filters below without a server round-trip.
  const [tab, setTab] = useState(activeTab);
  const searchParams = useSearchParams();
  const urlTab =
    TANK_TABS.find((t) => t.query === searchParams.get("tab"))?.id ??
    TankTab.Performances;
  if (urlTab !== tab) setTab(urlTab);

  const [storedRating] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const rangeMetric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;

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
    tanks,
    rangeCols,
    RANGE_DEFAULT[activeTab],
  );

  function selectTab(e: MouseEvent, next: TankTab) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (next === tab) return;
    setTab(next);
    // The range filter targets the active table's columns, so reset it.
    filters.resetRange(RANGE_DEFAULT[next]);
    window.history.pushState(null, "", tankTabHref(basePath, next));
  }

  return (
    <Panel>
      <PanelHeader className="px-0! py-0!">
        <nav className="flex items-center overflow-x-auto text-sm">
          {TANK_TABS.map((t) => (
            <a
              key={t.id}
              href={tankTabHref(basePath, t.id)}
              onClick={(e) => selectTab(e, t.id)}
              className={cn(
                "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
                tab === t.id
                  ? "bg-fd-secondary/40 text-fd-foreground"
                  : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
              )}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </PanelHeader>
      <PanelContent className="space-y-4 p-4">
        <TankFilterBar
          filters={filters}
          searchNoun="tanks"
          extra={
            <>
              {tab === TankTab.Performances && <PerfColumnSelector />}
              {tab === TankTab.Specifications && <SpecColumnSelector />}
            </>
          }
        />
      </PanelContent>
      <div className="border-t border-fd-border">
        {tab === TankTab.Performances && (
          <TanksTable region={region} rows={filtered} />
        )}
        {tab === TankTab.Specifications && (
          <TanksSpecsTable region={region} rows={filtered} />
        )}
        {tab === TankTab.Economics && (
          <TanksEconTable region={region} rows={filtered} />
        )}
        {tab === TankTab.MarksOfMastery && (
          <TanksMasteryTable region={region} rows={filtered} />
        )}
        {tab === TankTab.MarksOfExcellence && (
          <TanksMoeTable region={region} rows={filtered} />
        )}
      </div>
    </Panel>
  );
}
