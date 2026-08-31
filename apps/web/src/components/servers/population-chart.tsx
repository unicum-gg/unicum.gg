"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ServerPopulationPoint,
  serverDisplayName,
  type ServerStatsRange,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
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
 * The region's population over the range, stacked by cluster.
 *
 * Stacked rather than one line per cluster because the question the page is
 * asked first is how many people are playing, and the stack's outline answers
 * it while each band still shows how the clusters split the load. The clusters
 * are keyed by position (`s0`, `s1`, ...) rather than by name: Wargaming's names
 * are arbitrary strings and one of them could collide with a field this chart
 * needs, and the payload already fixes the order.
 */

// Five defined chart colors, cycled if a region ever reports more clusters than
// that. EU, the widest, currently reports five.
const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const key = (index: number) => `s${index}`;

export function PopulationChart({
  servers,
  points,
  range,
  region,
}: {
  servers: string[];
  points: ServerPopulationPoint[];
  range: ServerStatsRange;
  region: Region;
}) {
  /**
   * The clusters in identity order, carrying the payload index their values
   * live at.
   *
   * The payload lists them busiest first, which is the order `values` is
   * aligned to. Everything drawn is re-keyed to this order instead, for two
   * reasons: the legend and the stack then read EU1..EU5 like the chips and the
   * table above (recharts orders its legend by data key, not by render order,
   * so reordering the elements alone did nothing), and a cluster keeps its
   * colour. Coloured by rank, the bands swapped hues whenever two servers
   * traded places, which on a range switch looked like the data had changed.
   */
  const order = useMemo(
    () =>
      servers
        .map((server, index) => ({ server, index }))
        .sort((a, b) =>
          serverDisplayName(region, a.server).localeCompare(
            serverDisplayName(region, b.server),
            "en",
            { numeric: true },
          ),
        ),
    [servers, region],
  );

  const zone = useDisplayZone();
  const config = useMemo(
    () =>
      Object.fromEntries(
        order.map(({ server }, position) => [
          key(position),
          {
            label: serverDisplayName(region, server),
            color: PALETTE[position % PALETTE.length],
          },
        ]),
      ) satisfies ChartConfig,
    [order, region],
  );

  const data = useMemo(
    () =>
      points.map((point) => {
        const row: Record<string, number> = { t: point.at.getTime() };
        order.forEach(({ index }, position) => {
          row[key(position)] = point.values[index] ?? 0;
        });
        return row;
      }),
    [points, order],
  );

  const peak = useMemo(
    () => points.reduce((max, p) => Math.max(max, p.total), 0),
    [points],
  );

  // Two points make a curve. One draws five stranded dots that read as a broken
  // chart rather than as a range the recording has not reached yet, which is
  // what it is for as long as the history is younger than the range.
  if (points.length < 2) {
    return (
      <p className="flex h-64 items-center justify-center px-4 text-center text-sm text-fd-muted-foreground">
        Not enough recorded yet for this range. It fills in as the sampling
        continues.
      </p>
    );
  }

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-64 w-full"
      aria-label={`Players online per server over the last ${range}`}
    >
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
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
          // Anchored at zero: a population chart that crops its baseline turns a
          // routine evening dip into a cliff.
          domain={[0, Math.ceil(peak * 1.05)]}
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
        {order.map(({ server }, position) => (
          <Area
            key={server}
            dataKey={key(position)}
            type="monotone"
            stackId="population"
            stroke={PALETTE[position % PALETTE.length]}
            fill={PALETTE[position % PALETTE.length]}
            fillOpacity={0.28}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
