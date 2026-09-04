"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  SERVER_STATS_RANGE_LABEL,
  SERVER_STATS_RANGES,
  type ServerComparison,
  type ServerStats,
  ServerStatsRange,
} from "@unicum.gg/shared";
import { REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { SegmentedControl } from "@/components/segmented-control";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";
import { ClustersTable } from "./clusters-table";
import { PopulationChart } from "./population-chart";
import { ServerRecords } from "./records";
import { RegionsChart } from "./regions-chart";
import { RhythmHeatmap } from "./rhythm-heatmap";

/**
 * The range-switching half of the servers page.
 *
 * The range lives in component state rather than in the URL, which is what
 * keeps the page statically rendered: it is a way of reading the same data, not
 * a different page, so it earns no `searchParams` and no dynamic rendering. The
 * server renders the default range, and switching refetches through the SDK.
 *
 * The weekly rhythm is range-independent (it always reads the trailing four
 * weeks) but still reads from `shown` rather than from the initial payload: a
 * prerender that fell back to `buildSafe`'s empty shell carries no cells, and
 * pinned to that it would stay empty forever while every other panel healed on
 * the first client fetch.
 */
export function ServersDashboard({
  region,
  initialRange,
  initialStats,
  initialComparison,
}: {
  region: Region;
  initialRange: ServerStatsRange;
  initialStats: ServerStats;
  initialComparison: ServerComparison;
}) {
  const [range, setRange] = useState(initialRange);
  const isInitial = range === initialRange;

  const statsRequest = unicum.region(region).server.stats(range);
  const { data: stats, isLoading: statsLoading } = useSWR(
    statsRequest.url(),
    async () => (await statsRequest) as unknown as ServerStats,
    {
      fallbackData: isInitial ? initialStats : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  const comparisonRequest = unicum.servers.compare(range);
  const { data: comparison } = useSWR(
    comparisonRequest.url(),
    async () => (await comparisonRequest) as unknown as ServerComparison,
    {
      fallbackData: isInitial ? initialComparison : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  const label = REGION_LABEL[region];
  const shown = stats ?? initialStats;
  const shownRange = shown.range;
  const pending = statsLoading && !stats;

  return (
    <>
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>{label} players online over time</PanelTitle>
          <SegmentedControl
            segments={SERVER_STATS_RANGES.map((id) => ({
              id,
              label: SERVER_STATS_RANGE_LABEL[id],
            }))}
            active={range}
            onSelect={setRange}
          />
        </PanelHeader>
        <PanelContent
          className={cn("transition-opacity", pending && "opacity-50")}
        >
          <PopulationChart
            servers={shown.servers}
            points={shown.points}
            range={shownRange}
            region={region}
          />
        </PanelContent>
        {/* Inside the chart's panel rather than beside it: these four figures
            summarise the very range the switcher above selects, so they are
            part of that section rather than a section of their own. */}
        <PanelContent className="border-t border-fd-border p-0">
          <ServerRecords stats={shown} range={shownRange} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{label} servers</PanelTitle>
        </PanelHeader>
        {/* No padding: the table carries it on its own cells, so its rules run
            edge to edge and meet the panel's borders. */}
        <PanelContent className="p-0">
          <ClustersTable
            clusters={shown.clusters}
            range={shownRange}
            region={region}
            total={shown.current}
            peak={shown.peak}
            average={shown.average}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>When {label} players are online</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <RhythmHeatmap rhythm={shown.rhythm} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Every region compared</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-4">
          {comparison ? (
            <>
              <RegionsChart regions={comparison.regions} range={shownRange} />
              <ul className="flex flex-wrap gap-2 text-sm">
                {comparison.regions.map((series) => (
                  <li
                    key={series.region}
                    className={cn(
                      "inline-flex items-baseline gap-2 rounded-md border px-2.5 py-1",
                      series.region === region
                        ? "border-brand/40 bg-brand/10"
                        : "border-fd-border bg-fd-card",
                    )}
                  >
                    <span className="font-medium">
                      {REGION_LABEL[series.region]}
                    </span>
                    <span className="tabular-nums text-fd-muted-foreground">
                      {series.current == null
                        ? "—"
                        : series.current.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="h-56" />
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
