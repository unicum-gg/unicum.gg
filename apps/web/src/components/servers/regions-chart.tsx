"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { RegionPopulationSeries, ServerStatsRange } from "@unicum.gg/shared";
import { REGION_LABEL } from "@unicum.gg/wargaming";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMoment, formatPlayersCompact, formatTick } from "./format";
import { useDisplayZone } from "./use-display-zone";

/**
 * The three regions' totals on one timeline.
 *
 * Lines rather than a stack: nobody plays "the sum of all regions", and adding
 * EU to NA would only draw a number that exists nowhere. What the comparison is
 * for is the gap between them and how differently their days are shaped, which
 * three curves on a shared axis show and a stack hides.
 *
 * The regions are bucketed identically, so their points share timestamps and
 * can be merged into one dataset. A region missing a bucket leaves a gap in its
 * own line instead of dragging it to zero: it was not sampled, not empty.
 */

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export function RegionsChart({
  regions,
  range,
}: {
  regions: RegionPopulationSeries[];
  range: ServerStatsRange;
}) {
  const zone = useDisplayZone();
  const config = useMemo(
    () =>
      Object.fromEntries(
        regions.map((series, i) => [
          series.region,
          {
            label: REGION_LABEL[series.region],
            color: PALETTE[i % PALETTE.length],
          },
        ]),
      ) satisfies ChartConfig,
    [regions],
  );

  const data = useMemo(() => {
    const byInstant = new Map<number, Record<string, number>>();
    for (const series of regions) {
      for (const point of series.points) {
        const t = point.at.getTime();
        let row = byInstant.get(t);
        if (!row) {
          row = { t };
          byInstant.set(t, row);
        }
        row[series.region] = point.total;
      }
    }
    return [...byInstant.values()].sort((a, b) => a.t - b.t);
  }, [regions]);

  // Same rule as the population chart: one instant is not a curve.
  if (data.length < 2) {
    return (
      <p className="flex h-56 items-center justify-center px-4 text-center text-sm text-fd-muted-foreground">
        Not enough recorded yet for this range. It fills in as the sampling
        continues.
      </p>
    );
  }

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-56 w-full"
      aria-label={`Players online per region over the last ${range}`}
    >
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={48}
          tickFormatter={(value: number) => formatTick(new Date(value), range, zone)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={formatPlayersCompact}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const t = payload?.[0]?.payload?.t as number | undefined;
                return t === undefined ? "" : formatMoment(new Date(t), zone);
              }}
            />
          }
        />
        {regions.map((series, i) => (
          <Line
            key={series.region}
            dataKey={series.region}
            type="monotone"
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </LineChart>
    </ChartContainer>
  );
}
