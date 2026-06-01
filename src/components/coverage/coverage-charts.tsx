"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DailyPoint } from "@/services/coverage";

const config = {
  count: {
    label: "Count",
    color: "#f25322",
  },
} satisfies ChartConfig;

const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function tickFormatter(value: string) {
  const d = new Date(value);
  return dayFmt.format(d);
}

export function CoverageAreaChart({
  data,
  ariaLabel,
}: {
  data: DailyPoint[];
  ariaLabel: string;
}) {
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-48 w-full"
      aria-label={ariaLabel}
    >
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f25322" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#f25322" stopOpacity={0} />
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
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) =>
                new Date(value as string).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              }
            />
          }
        />
        <Area
          dataKey="count"
          type="monotone"
          stroke="#f25322"
          strokeWidth={2}
          fill="url(#fillCount)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
