"use client";

import { useFormat } from "@/hooks/use-format";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const DAY_PATTERN = "d MMM";
const TOOLTIP_DAY_PATTERN = "EEE d MMM";
const VALUE_FORMAT = { maximumFractionDigits: 0 } as const;

export type MarksSeries = {
  key: string;
  label: string;
  color: string;
};

// Shared multi-line time-series for the Marks tab (MoE requirements, mastery XP
// thresholds). Each `series` is one line; rows carry a `day` (ISO date) plus one
// numeric field per series key. Styled to match the player rating chart.
export function MarksHistoryChart({
  data,
  series,
  ariaLabel,
}: {
  data: Array<Record<string, string | number>>;
  series: MarksSeries[];
  ariaLabel: string;
}) {
  const { num } = useFormat();
  const { date } = useFormat();
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-56 w-full"
      aria-label={ariaLabel}
    >
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(v) => date(DAY_PATTERN).format(new Date(v))}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
          allowDecimals={false}
          domain={["auto", "auto"]}
          tickFormatter={(v) => num(VALUE_FORMAT).format(Number(v))}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(label) =>
                date(TOOLTIP_DAY_PATTERN).format(new Date(label as string))
              }
            />
          }
        />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </LineChart>
    </ChartContainer>
  );
}
