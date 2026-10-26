"use client";

import { useMemo } from "react";
import type { LoadoutMode } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { FilterSubject } from "@/components/filter-subject";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { TankFilterBar } from "@/components/tanks/tank-filter-bar";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import { useTankFilters, type RangeColumn } from "@/hooks/use-tank-filters";
import { RATING_METRIC_LABEL } from "@unicum.gg/shared";
import { useMapMode } from "./mode";
import { MapTankTable } from "./tank-table";
import type { MapTankRow } from "./tank-rows";

/**
 * The vehicles section: the catalogue's own filter bar over the table, as on
 * every other vehicle list (`components/tanks/list/community/board.tsx`), so
 * tier, nation, class, role and category narrow it exactly as they do there.
 *
 * ONE instance under every mode, fed the active mode's rows: the filters live
 * in the URL, and a table per mode would be several components writing the
 * same params. Switching mode keeps the filters, which is what a reader who
 * narrowed to tier X wants when they look at the same tanks in Onslaught.
 */
export function MapVehicles({
  region,
  rowsByMode,
  titleByMode,
  hint,
}: {
  region: Region;
  rowsByMode: Partial<Record<LoadoutMode, MapTankRow[]>>;
  /** The heading names the mode, so it is resolved per mode by the server. */
  titleByMode: Partial<Record<LoadoutMode, string>>;
  hint: string;
}) {
  const { mode } = useMapMode();
  const { wnMetric: metric } = useRatingMetric();
  const rows = rowsByMode[mode] ?? EMPTY;

  // Labelled with the stat catalogue's own English keys, which the bar
  // translates, so "Battles" reads as the same word it does everywhere else.
  // Memoized: the filtered list is a memo over these, and `usePagination`
  // treats a new array as a new list.
  const rangeColumns = useMemo<RangeColumn<MapTankRow>[]>(() => [
    {
      key: "rating",
      label: RATING_METRIC_LABEL[metric],
      value: (row) => row.rating[metric],
    },
    { key: "battles", label: "Battles", value: (row) => row.stats.records },
    { key: "players", label: "Players", value: (row) => row.stats.players },
    { key: "damage", label: "Damage", value: (row) => row.stats.avgDamage },
    {
      key: "winrate",
      label: "Win rate",
      // In percent, matching the column: typing 55 next to "55 %" is what a
      // reader does, not 0.55.
      value: (row) => (row.stats.winrate == null ? null : row.stats.winrate * 100),
    },
  ], [metric]);
  const { filtered, filters } = useTankFilters(rows, rangeColumns, "battles");

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{titleByMode[mode]}</PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3 p-4">
        <p className="text-sm text-fd-muted-foreground">{hint}</p>
        <TankFilterBar filters={filters} searchNoun={FilterSubject.Tanks} />
      </PanelContent>
      <div className="border-t border-fd-border">
        <MapTankTable region={region} rows={filtered} />
      </div>
    </Panel>
  );
}

const EMPTY: MapTankRow[] = [];
