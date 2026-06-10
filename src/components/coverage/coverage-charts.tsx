"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { DailyPoint } from "@/services/coverage";

enum ChartMode {
  Daily = "daily",
  Cumulative = "cumulative",
}

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

function toCumulative(data: DailyPoint[]): DailyPoint[] {
  let sum = 0;
  return data.map((p) => {
    sum += p.count;
    return { day: p.day, count: sum };
  });
}

export function CoverageAreaChart({
  title,
  data,
  ariaLabel,
  defaultMode = ChartMode.Daily,
}: {
  title: string;
  data: DailyPoint[];
  ariaLabel: string;
  defaultMode?: ChartMode;
}) {
  const [mode, setMode] = useState<ChartMode>(defaultMode);
  const displayData = useMemo(
    () => (mode === ChartMode.Cumulative ? toCumulative(data) : data),
    [data, mode],
  );
  const suffix = mode === ChartMode.Cumulative ? "(cumulative)" : "per day";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
          {title} {suffix}
        </div>
        <div className="flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider">
          <ModeButton
            active={mode === ChartMode.Daily}
            onClick={() => setMode(ChartMode.Daily)}
          >
            Daily
          </ModeButton>
          <ModeButton
            active={mode === ChartMode.Cumulative}
            onClick={() => setMode(ChartMode.Cumulative)}
          >
            Cumulative
          </ModeButton>
        </div>
      </div>
      <ChartContainer
        config={config}
        className="aspect-auto h-48 w-full"
        aria-label={`${ariaLabel} (${mode})`}
      >
        <AreaChart
          data={displayData}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
        >
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
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded px-1.5 py-0.5 transition-colors",
        active
          ? "bg-fd-accent text-fd-accent-foreground"
          : "text-fd-muted-foreground hover:text-fd-foreground",
      )}
    >
      {children}
    </button>
  );
}

export { ChartMode };
