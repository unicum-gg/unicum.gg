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
import { useLocale } from "@onruntime/translations/react";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { type DisplayZone, formatMoment, formatPlayers } from "@/components/servers/format";
import type { ManeuversHistoryPoint } from "@/components/maneuvers/race";
import type { ManeuversBoardKind } from "@/components/maneuvers/rewards";
import { dateFormat } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";

// Loaded on demand by the panel, like the Onslaught season charts: recharts is
// heavy and the panel sits below a board of a thousand rows, and the ticks are
// formatted in the reader's own timezone, which a prerendered tick cannot know.

// An edition runs two weeks and is read by the day, but its first day is read
// by the hour: until the samples span more than one, every tick formats to the
// same date and the axis says nothing.
const WITHIN_A_DAY_MS = 36 * 60 * 60 * 1000;

const utc = (pattern: string, zone: DisplayZone) =>
  zone === "local" ? pattern : `${pattern} /* UTC */`;

export function ManeuversRaceCharts({
  kind,
  samples,
  zone,
}: {
  kind: ManeuversBoardKind;
  samples: ManeuversHistoryPoint[];
  zone: DisplayZone;
}) {
  const { t } = useTranslation("components/maneuvers/race");
  const { locale } = useLocale();
  const points = new Intl.NumberFormat(locale);
  const cutoffConfig = {
    cutoff: { label: t(`cutoff.${kind}`), color: "var(--chart-2)" },
  } satisfies ChartConfig;
  const rankedConfig = {
    ranked: { label: t(`ranked.${kind}`), color: "var(--chart-1)" },
  } satisfies ChartConfig;

  // Instants ride as milliseconds on a real time axis, never as categories: a
  // capture can miss a window, and a category axis would space the samples
  // evenly and draw a slope across a gap that never happened.
  const data = useMemo(
    () =>
      samples.map((p) => ({
        ms: p.t * 1000,
        cutoff: kind === "players" ? p.tankCutoffPoints : p.clanGoldCutoffPoints,
        ranked: kind === "players" ? p.playerCount : p.clanCount,
      })),
    [samples, kind],
  );

  const tick = useMemo(() => {
    const span = data.length >= 2 ? data[data.length - 1].ms - data[0].ms : 0;
    const fmt = dateFormat(
      locale,
      utc(span < WITHIN_A_DAY_MS ? "HH:mm" : "d MMM", zone),
    );
    return (value: number) => fmt.format(new Date(value));
  }, [data, zone, locale]);

  const label = useMemo(
    () =>
      (_: React.ReactNode, payload: readonly { payload?: { ms?: number } }[]) => {
        const ms = payload?.[0]?.payload?.ms;
        return ms != null ? formatMoment(new Date(ms), zone, locale) : "";
      },
    [zone, locale],
  );

  return (
    <div className="grid grid-cols-1 divide-y divide-fd-border border-t border-fd-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
      <Figure title={t(`cutoff.${kind}`)}>
        <ChartContainer config={cutoffConfig} className="h-56 w-full">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            {timeAxis(tick)}
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[0, "auto"]}
              tickFormatter={(v: number) => points.format(v)}
            />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={label} />} />
            <Line
              dataKey="cutoff"
              stroke="var(--color-cutoff)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      </Figure>

      <Figure title={t(`ranked.${kind}`)}>
        <ChartContainer config={rankedConfig} className="h-56 w-full">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            {timeAxis(tick)}
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[0, "auto"]}
              tickFormatter={(v: number) => formatPlayers(v, locale)}
            />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={label} />} />
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

/** The shared time axis, rendered inline: recharts reads its axes off its
 * direct children. */
function timeAxis(tick: (value: number) => string) {
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

function Figure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="p-4">
      <figcaption className="mb-2 text-xs uppercase tracking-wide text-fd-muted-foreground">
        {title}
      </figcaption>
      {children}
    </figure>
  );
}
