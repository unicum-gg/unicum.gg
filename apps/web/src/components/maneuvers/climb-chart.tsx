"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useLocale } from "@onruntime/translations/react";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { type DisplayZone, formatMoment } from "@/components/servers/format";
import { dateFormat } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";

// Loaded on demand by the profile tabs, like the Onslaught climb: recharts is
// not worth carrying on a profile that holds no place on the board.

const WITHIN_A_DAY_MS = 36 * 60 * 60 * 1000;

export type ManeuversClimbPoint = { t: number; famePoints: number };
export type ManeuversCutoffPoint = { t: number; cutoff: number | null };

type Row = { ms: number; points?: number; cutoff?: number | null };

/**
 * One entry's climb through an edition against the line it is climbing
 * towards: the Fame Points a rewarded place costs, at each capture.
 *
 * Both are Fame Points, so they share a scale, and the gap between them is the
 * answer to "am I in": it moves on both sides at once, since the line is the
 * last rewarded place of a field that keeps playing.
 */
export function ManeuversClimbChart({
  climb,
  cutoffs,
  cutoffLabel,
  zone,
}: {
  climb: ManeuversClimbPoint[];
  cutoffs: ManeuversCutoffPoint[];
  /** What the line is the price of: a vehicle place, or a gold one. */
  cutoffLabel: string;
  zone: DisplayZone;
}) {
  const { t } = useTranslation("components/maneuvers/climb-chart");
  const { locale } = useLocale();
  const points = new Intl.NumberFormat(locale);
  const config = {
    points: { label: t("fame-points"), color: "var(--chart-1)" },
    cutoff: { label: cutoffLabel, color: "var(--chart-2)" },
  } satisfies ChartConfig;

  const data = useMemo(() => {
    const byInstant = new Map<number, Row>();
    for (const c of cutoffs) byInstant.set(c.t, { ms: c.t * 1000, cutoff: c.cutoff });
    for (const p of climb) {
      const row = byInstant.get(p.t) ?? { ms: p.t * 1000 };
      row.points = p.famePoints;
      byInstant.set(p.t, row);
    }
    const rows = [...byInstant.values()].sort((a, b) => a.ms - b.ms);
    // The capture records an entry only at the instants it MOVED, so a missing
    // row means unchanged rather than unknown: carried forward, never back,
    // since before its first row it was not on the board.
    let carried: number | undefined;
    for (const row of rows) {
      if (row.points != null) carried = row.points;
      else if (carried != null) row.points = carried;
    }
    return rows;
  }, [climb, cutoffs]);

  const tick = useMemo(() => {
    const span = data.length >= 2 ? data[data.length - 1].ms - data[0].ms : 0;
    const pattern = span < WITHIN_A_DAY_MS ? "HH:mm" : "d MMM";
    const fmt = dateFormat(locale, zone === "local" ? pattern : `${pattern} /* UTC */`);
    return (value: number) => fmt.format(new Date(value));
  }, [data, zone, locale]);

  const label = (
    _: React.ReactNode,
    payload: readonly { payload?: { ms?: number } }[],
  ) => {
    const ms = payload?.[0]?.payload?.ms;
    return ms != null ? formatMoment(new Date(ms), zone, locale) : "";
  };

  return (
    <div className="border-t border-fd-border p-4">
      <ChartContainer config={config} className="h-56 w-full">
        <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            domain={[0, "auto"]}
            tickFormatter={(v: number) => points.format(v)}
          />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={label} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            dataKey="cutoff"
            stroke="var(--color-cutoff)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
          <Line
            dataKey="points"
            stroke="var(--color-points)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
