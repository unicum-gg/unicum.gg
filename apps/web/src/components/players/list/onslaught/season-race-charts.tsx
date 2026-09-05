"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { ONSLAUGHT_TIER_LABEL, OnslaughtTier } from "@unicum.gg/shared";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { type DisplayZone, formatMoment, formatPlayers } from "@/components/servers/format";
import { CHAMPION, LEGEND_DARK, LEGEND_LIGHT } from "./season-race-colors";
import type { OnslaughtSeasonPoint } from "./season-race";

// Loaded on demand by the panel (recharts is ~107 KB gzipped and the panel sits
// well below a leaderboard of a few thousand rows), which is also what keeps
// these axes off the server: their ticks are formatted in the reader's own
// timezone, and a prerendered tick would carry the container's instead.

const cutoffConfig = {
  legendPoints: {
    label: ONSLAUGHT_TIER_LABEL[OnslaughtTier.Legend],
    theme: { light: LEGEND_LIGHT, dark: LEGEND_DARK },
  },
  championPoints: {
    label: ONSLAUGHT_TIER_LABEL[OnslaughtTier.Champion],
    color: CHAMPION,
  },
} satisfies ChartConfig;

const rankedConfig = {
  ranked: { label: "Ranked players", color: "var(--chart-1)" },
} satisfies ChartConfig;

const points = new Intl.NumberFormat("en-US");

// A season runs about six weeks and is read by the day, but its first days are
// read by the hour: until the samples span more than one, every tick formats to
// the same date and the axis says nothing.
const WITHIN_A_DAY_MS = 36 * 60 * 60 * 1000;

function tickFormatters(zone: DisplayZone) {
  return {
    dayMonth: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: zone === "local" ? undefined : "UTC",
    }),
    timeOfDay: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: zone === "local" ? undefined : "UTC",
    }),
  };
}

export function OnslaughtSeasonCharts({
  samples,
  zone,
}: {
  samples: OnslaughtSeasonPoint[];
  zone: DisplayZone;
}) {
  // Instants ride as milliseconds on a real time axis, never as categories: the
  // capture can miss a window (a restart, an upstream blip), and a category axis
  // would space the samples evenly and hide the gap, drawing a slope across it
  // that never happened.
  const data = useMemo(
    () => samples.map((p) => ({ ...p, ms: p.t * 1000 })),
    [samples],
  );

  const tick = useMemo(() => {
    const span =
      data.length >= 2 ? data[data.length - 1].ms - data[0].ms : 0;
    const { dayMonth, timeOfDay } = tickFormatters(zone);
    const fmt = span < WITHIN_A_DAY_MS ? timeOfDay : dayMonth;
    return (value: number) => fmt.format(new Date(value));
  }, [data, zone]);

  // The tooltip's own label arrives typed as a node rather than as the axis
  // value, so the instant is read back off the sample the tooltip is showing.
  const label = useMemo(
    () =>
      (_: React.ReactNode, payload: readonly { payload?: { ms?: number } }[]) => {
        const ms = payload?.[0]?.payload?.ms;
        return ms != null ? formatMoment(new Date(ms), zone) : "";
      },
    [zone],
  );

  return (
    <div className="grid grid-cols-1 divide-y divide-fd-border border-t border-fd-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
      <Figure title="Rank cutoffs">
        <ChartContainer config={cutoffConfig} className="h-56 w-full">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <TimeAxis tick={tick} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              // Rating points sit in a narrow band well above zero, so the axis
              // frames the band it is drawing rather than the origin.
              domain={["dataMin - 40", "dataMax + 40"]}
              tickFormatter={(v: number) => points.format(v)}
            />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={label} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="legendPoints"
              stroke="var(--color-legendPoints)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              dataKey="championPoints"
              stroke="var(--color-championPoints)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      </Figure>

      <Figure title="Ranked players">
        <ChartContainer config={rankedConfig} className="h-56 w-full">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <TimeAxis tick={tick} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => formatPlayers(v)}
            />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={label} />}
            />
            <Area
              dataKey="ranked"
              stroke="var(--color-ranked)"
              fill="var(--color-ranked)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </Figure>
    </div>
  );
}

/** The shared time axis: same key, same scale, same ticks on both charts. */
function TimeAxis({ tick }: { tick: (value: number) => string }) {
  return (
    <XAxis
      dataKey="ms"
      type="number"
      scale="time"
      domain={["dataMin", "dataMax"]}
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      minTickGap={32}
      tickFormatter={tick}
    />
  );
}

function Figure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="p-4">
      <figcaption className="mb-2 text-xs uppercase tracking-wide text-fd-muted-foreground">
        {title}
      </figcaption>
      {children}
    </figure>
  );
}
