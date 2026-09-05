"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  RATING_COLOR_HEX,
  RatingMetric,
  SessionGranularity,
  wn7Color,
  wn8Color,
  wnxColor,
  type PlayerSession,
  type RatingColor,
} from "@unicum.gg/shared";
import {
  GRANULARITY_NOUN,
  sessionAxisLabel,
  sessionLabel,
} from "./labels";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const COLOR_FN: Record<RatingMetric, (v: number) => RatingColor> = {
  [RatingMetric.Wn7]: wn7Color,
  [RatingMetric.Wn8]: wn8Color,
  [RatingMetric.Wnx]: wnxColor,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days the daily view will draw, empty ones included. Roughly two quarters,
 * which comfortably holds 90 played days for anyone who plays regularly and
 * bounds the axis for anyone who does not. */
const MAX_DAILY_SLOTS = 180;

/**
 * When this account played, and how it went.
 *
 * The same histogram the region's distributions are drawn as, on the same
 * rating bands: the bar is how much was played and its colour is what the
 * rating was over those battles. That second channel is the reason the chart
 * earns its place above a table that already lists every row: a table makes you
 * read the ratings line by line, while here a cold streak is a run of red and a
 * hot one a run of purple.
 *
 * Buckets with no battles are kept as empty slots so the gaps between sessions
 * keep their real width, and a fortnight off does not compress into the same
 * space as a weekend.
 */
export function PlayerActivityChart({
  sessions,
  granularity,
  metric,
  metricLabel,
}: {
  sessions: PlayerSession[];
  granularity: SessionGranularity;
  metric: RatingMetric;
  metricLabel: string;
}) {
  const colorFn = COLOR_FN[metric];

  const data = useMemo(() => {
    const played = new Map(sessions.map((s) => [s.period, s]));
    return slotsFor(sessions, granularity).map((period) => {
      const s = played.get(period);
      const rating = s ? s[metric] : null;
      return {
        period,
        label: sessionAxisLabel(period, granularity),
        full: sessionLabel(period, granularity),
        battles: s?.battles ?? 0,
        rating,
        winrate: s ? s.winrate : null,
        color:
          rating != null
            ? RATING_COLOR_HEX[colorFn(rating)]
            : "var(--fd-muted-foreground)",
      };
    });
  }, [sessions, granularity, metric, colorFn]);

  const config = useMemo(
    () => ({ battles: { label: "Battles" } }) satisfies ChartConfig,
    [],
  );

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-48 w-full"
      aria-label={`Battles played per ${GRANULARITY_NOUN[granularity]}, coloured by ${metricLabel}`}
    >
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload?.full as string) ?? ""
              }
              formatter={(value, _name, item) => {
                const rating = item?.payload?.rating as number | null;
                const battles = Number(value);
                if (battles === 0) return <span>No battles</span>;
                return (
                  <span>
                    {intFmt.format(battles)} battles
                    {rating != null
                      ? `, ${intFmt.format(rating)} ${metricLabel}`
                      : ""}
                  </span>
                );
              }}
            />
          }
        />
        {/* Capped: ninety daily bars never reach it, but four monthly ones
            spread across a full-width panel would each be a slab. */}
        <Bar
          dataKey="battles"
          isAnimationActive={false}
          radius={[2, 2, 0, 0]}
          maxBarSize={40}
        >
          {data.map((row) => (
            <Cell key={row.period} fill={row.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/**
 * The buckets to draw, with the empty days filled in.
 *
 * The endpoint returns the 90 most recent *played* days, not the last 90 days,
 * so on an account that plays a handful of days a month those 90 buckets can
 * span years. Filling every calendar day between the first and the last would
 * then emit thousands of bars for a chart that is 90 of them at most. The
 * window is therefore capped: days older than the cap are dropped, and the
 * reader has the Weekly and Monthly views for the ground they covered.
 *
 * Weeks and months are already sparse enough to draw as they come.
 */
function slotsFor(
  sessions: PlayerSession[],
  granularity: SessionGranularity,
): string[] {
  const periods = sessions.map((s) => s.period).sort();
  if (periods.length === 0) return [];
  if (granularity !== SessionGranularity.Daily) return periods;

  const last = Date.parse(`${periods[periods.length - 1]}T00:00:00Z`);
  const oldest = Date.parse(`${periods[0]}T00:00:00Z`);
  const start = Math.max(oldest, last - (MAX_DAILY_SLOTS - 1) * DAY_MS);

  const slots: string[] = [];
  for (let ms = start; ms <= last; ms += DAY_MS) {
    slots.push(new Date(ms).toISOString().slice(0, 10));
  }
  return slots;
}
