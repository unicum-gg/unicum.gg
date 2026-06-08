"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RatingHistoryPoint } from "@/services/players/rating-history";

const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const tooltipDayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const valueFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const CHART_COLOR = "#f25322";

function tickFormatter(value: string) {
  return dayFmt.format(new Date(value));
}

export function PlayerRatingChart({
  data,
  metricLabel,
}: {
  data: RatingHistoryPoint[];
  metricLabel: string;
}) {
  const config = {
    value: {
      label: metricLabel,
      color: CHART_COLOR,
    },
  } satisfies ChartConfig;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-56 w-full"
      aria-label={`${metricLabel} over time, daily rolling 30-day series`}
    >
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillPlayerRating" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.5} />
            <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={tickFormatter}
          minTickGap={32}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
          allowDecimals={false}
          tickFormatter={(v) => valueFmt.format(Number(v))}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(label) =>
                tooltipDayFmt.format(new Date(label as string))
              }
              formatter={(value) => valueFmt.format(Number(value))}
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke={CHART_COLOR}
          strokeWidth={2}
          fill="url(#fillPlayerRating)"
          connectNulls
        />
      </AreaChart>
    </ChartContainer>
  );
}
