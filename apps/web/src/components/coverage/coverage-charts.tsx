"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ChartMode } from "@/components/coverage/chart-mode";
import { cn } from "@/lib/utils";
import type { DailyPoint } from "@/services/coverage";

const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function tickFormatter(value: string) {
  const d = new Date(value);
  return dayFmt.format(d);
}

// Abbreviated axis labels (2.06M), because the counts run into the millions and
// would not fit the axis gutter. The tooltip keeps showing the exact count.
//
// How many decimals depends on the span: a cumulative series anchored on its
// real total only moves over its last digits, so a fixed single decimal printed
// "2.1M" on every tick. This sizes the precision to the gap between ticks (the
// span over the ~4 intervals recharts draws) so consecutive labels always
// differ, and Intl still drops trailing zeros where they are not needed.
function countFormatterFor(values: number[]): (value: number) => string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / 5;
  const magnitude = Math.max(Math.abs(max), 1);
  const unit = 1000 ** Math.min(3, Math.floor(Math.log10(magnitude) / 3));
  const digits =
    step > 0 ? Math.min(3, Math.max(0, Math.ceil(-Math.log10(step / unit)))) : 1;
  const fmt = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: digits,
  });
  return (value: number) => fmt.format(value);
}

// The axis gutter has to fit its widest label: "2.06M" needs more room than
// "90K", and a fixed width silently clipped the leading digits.
function axisWidthFor(
  values: number[],
  format: (value: number) => string,
): number {
  const longest = Math.max(
    ...values.map((v) => format(v).length),
    format(Math.min(...values)).length,
  );
  return Math.max(48, longest * 8 + 12);
}

// Running total, anchored on the series' real total rather than on the window.
//
// The daily rows only cover the last 30 days, so summing them from zero drew a
// curve ending at the window's own total: "new players discovered" climbed to a
// few thousand when the tracker actually holds millions. Starting from
// `total - windowSum` makes the last point equal the real total and every
// earlier point the count as it stood that day. Without a total (or with an
// inconsistent one, e.g. a series whose rows outrun its counter) it degrades to
// the window-only sum instead of drawing a negative baseline.
function toCumulative(data: DailyPoint[], total?: number): DailyPoint[] {
  const windowSum = data.reduce((acc, p) => acc + p.count, 0);
  let sum = total === undefined ? 0 : Math.max(0, total - windowSum);
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
  valueLabel = "Count",
  allowCumulative = true,
  suffixDaily = "per day",
  total,
}: {
  title: string;
  data: DailyPoint[];
  ariaLabel: string;
  defaultMode?: ChartMode;
  valueLabel?: string;
  allowCumulative?: boolean;
  suffixDaily?: string;
  /** All-time total this series accumulates to, so the cumulative curve ends on
   * the real figure instead of on the 30-day window's own sum. */
  total?: number;
}) {
  const [mode, setMode] = useState<ChartMode>(defaultMode);
  const effectiveMode = allowCumulative ? mode : ChartMode.Daily;
  const displayData = useMemo(
    () =>
      effectiveMode === ChartMode.Cumulative ? toCumulative(data, total) : data,
    [data, effectiveMode, total],
  );
  const counts = useMemo(() => displayData.map((p) => p.count), [displayData]);
  const countTickFormatter = useMemo(() => countFormatterFor(counts), [counts]);
  const axisWidth = useMemo(
    () => axisWidthFor(counts, countTickFormatter),
    [counts, countTickFormatter],
  );
  const config = useMemo(
    () =>
      ({
        count: {
          label: valueLabel,
          color: "var(--brand)",
        },
      }) satisfies ChartConfig,
    [valueLabel],
  );
  const suffix =
    effectiveMode === ChartMode.Cumulative ? "(cumulative)" : suffixDaily;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
          {title} {suffix}
        </div>
        {allowCumulative && (
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
        )}
      </div>
      <ChartContainer
        config={config}
        className="aspect-auto h-48 w-full"
        aria-label={`${ariaLabel} (${effectiveMode})`}
      >
        <AreaChart
          data={displayData}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
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
            width={axisWidth}
            allowDecimals={false}
            tickFormatter={countTickFormatter}
            // Anchored on the real total, a cumulative curve moves by a few
            // thousand on a base of millions, so a zero-based axis flattens it
            // into a straight line. Framing it on the window's own range keeps
            // the growth visible while the labels still read the true figures.
            // Daily series stay zero-based, where the baseline is meaningful.
            domain={
              effectiveMode === ChartMode.Cumulative
                ? ["dataMin", "dataMax"]
                : [0, "auto"]
            }
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
            stroke="var(--brand)"
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
