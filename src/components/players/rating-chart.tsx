"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { RatingMetric } from "@/constants/rating";
import type { RatingHistoryPoint } from "@/services/players/rating-history";
import {
  RATING_COLOR_HEX,
  type RatingColor,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@/services/wargaming/wot/ratings";

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

// Tier thresholds per metric, mirroring the buckets in
// src/services/wargaming/wot/ratings.ts. Used to place gradient stops where
// the colored line should "jump" from one tier to the next.
const TIER_THRESHOLDS: Record<RatingMetric, readonly number[]> = {
  [RatingMetric.Wn7]: [500, 700, 900, 1100, 1350, 1550, 1850, 2050],
  [RatingMetric.Wn8]: [300, 600, 900, 1250, 1600, 1900, 2350, 2900],
  [RatingMetric.Wnx]: [200, 400, 800, 1200, 1600, 1800, 2200, 2800],
};

const COLOR_FN: Record<RatingMetric, (v: number) => RatingColor> = {
  [RatingMetric.Wn7]: wn7Color,
  [RatingMetric.Wn8]: wn8Color,
  [RatingMetric.Wnx]: wnxColor,
};

function tickFormatter(value: string) {
  return dayFmt.format(new Date(value));
}

function buildGradientStops(
  minVal: number,
  maxVal: number,
  metric: RatingMetric,
): { offset: number; color: string }[] {
  const colorFn = COLOR_FN[metric];
  const thresholds = TIER_THRESHOLDS[metric];
  if (minVal === maxVal) {
    const color = RATING_COLOR_HEX[colorFn(minVal)];
    return [
      { offset: 0, color },
      { offset: 1, color },
    ];
  }
  // Gradient spans the line's bounding box. offset 0 = top (= maxVal),
  // offset 1 = bottom (= minVal). For each tier threshold inside the
  // range we drop two stops at the same offset (color above + color
  // below) to get a sharp tier transition instead of a soft fade.
  const stops: { offset: number; color: string }[] = [];
  stops.push({ offset: 0, color: RATING_COLOR_HEX[colorFn(maxVal)] });
  for (const t of [...thresholds].sort((a, b) => b - a)) {
    if (t > minVal && t < maxVal) {
      const offset = 1 - (t - minVal) / (maxVal - minVal);
      stops.push({ offset, color: RATING_COLOR_HEX[colorFn(t)] });
      stops.push({ offset, color: RATING_COLOR_HEX[colorFn(t - 0.01)] });
    }
  }
  stops.push({ offset: 1, color: RATING_COLOR_HEX[colorFn(minVal)] });
  return stops;
}

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: RatingHistoryPoint;
};

const PRIMARY_COLOR = "var(--color-fd-primary)";

export function PlayerRatingChart({
  data,
  metricLabel,
  metric,
}: {
  data: RatingHistoryPoint[];
  metricLabel: string;
  metric: RatingMetric;
}) {
  // Round at the source so the tooltip, axis, and dots all show the same
  // integer values. The chart doesn't need sub-unit precision and the
  // default tooltip formatter prints every decimal otherwise.
  const chartData = data.map((d) => ({
    day: d.day,
    lifetime: d.lifetime === null ? null : Math.round(d.lifetime),
    session: d.session === null ? null : Math.round(d.session),
  }));
  const colorFn = COLOR_FN[metric];
  const sessionValues = chartData
    .map((d) => d.session)
    .filter((v): v is number => v !== null);
  const hasSessions = sessionValues.length > 0;
  const sessionMin = hasSessions ? Math.min(...sessionValues) : 0;
  const sessionMax = hasSessions ? Math.max(...sessionValues) : 1;
  const sessionStops = hasSessions
    ? buildGradientStops(sessionMin, sessionMax, metric)
    : [];
  const latestSession = sessionValues.at(-1);
  const sessionLegendColor =
    latestSession !== undefined
      ? RATING_COLOR_HEX[colorFn(latestSession)]
      : PRIMARY_COLOR;

  const config = {
    lifetime: {
      label: `${metricLabel} (overall)`,
      color: PRIMARY_COLOR,
    },
    session: {
      label: `${metricLabel} (per session)`,
      color: sessionLegendColor,
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-56 w-full"
      aria-label={`${metricLabel} over time: overall and per-session lines`}
    >
      <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="strokeSession" x1="0" y1="0" x2="0" y2="1">
            {sessionStops.map((s, i) => (
              <stop
                key={`s-${i}-${s.offset}`}
                offset={s.offset}
                stopColor={s.color}
              />
            ))}
          </linearGradient>
          <linearGradient id="fillLifetime" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY_COLOR} stopOpacity={0.4} />
            <stop offset="100%" stopColor={PRIMARY_COLOR} stopOpacity={0} />
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
            />
          }
        />
        {/* Session line: thinner, dashed, tier-colored gradient. Spiky. */}
        <Area
          dataKey="session"
          type="monotone"
          stroke="url(#strokeSession)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          fill="none"
          connectNulls
          dot={({ cx, cy, payload }: DotProps) => {
            if (cx === undefined || cy === undefined) return <g />;
            const v = payload?.session;
            if (v === null || v === undefined) return <g />;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={2.5}
                fill={RATING_COLOR_HEX[colorFn(v)]}
                stroke="var(--color-fd-background)"
                strokeWidth={1}
              />
            );
          }}
          activeDot={false}
          isAnimationActive={false}
        />
        {/* Lifetime line: thick, solid primary color, faint fill. */}
        <Area
          dataKey="lifetime"
          type="monotone"
          stroke={PRIMARY_COLOR}
          strokeWidth={2.5}
          fill="url(#fillLifetime)"
          connectNulls
          dot={({ cx, cy, payload }: DotProps) => {
            if (cx === undefined || cy === undefined) return <g />;
            const v = payload?.lifetime;
            if (v === null || v === undefined) return <g />;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={3}
                fill={PRIMARY_COLOR}
                stroke="var(--color-fd-background)"
                strokeWidth={1.5}
              />
            );
          }}
          activeDot={({ cx, cy, payload }: DotProps) => {
            if (cx === undefined || cy === undefined) return <g />;
            const v = payload?.lifetime;
            if (v === null || v === undefined) return <g />;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={5}
                fill={PRIMARY_COLOR}
                stroke="var(--color-fd-background)"
                strokeWidth={2}
              />
            );
          }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
