"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
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
import { type DisplayZone, formatMoment } from "@/components/servers/format";
import {
  LEGEND_DARK,
  LEGEND_LIGHT,
} from "@/components/players/list/onslaught/season-race-colors";

// Loaded on demand by the panel: recharts is not worth carrying on a profile
// that turns out to have no Onslaught record, which is almost every profile.

export type ClimbPoint = {
  t: number;
  rank: number;
  rating: number;
  battles: number;
};
export type CutoffPoint = { t: number; legendPoints: number | null };

const config = {
  played: { label: "Battles played", color: "var(--chart-2)" },
  rating: { label: "Rating points", color: "var(--chart-1)" },
  legend: {
    label: `${ONSLAUGHT_TIER_LABEL[OnslaughtTier.Legend]} cutoff`,
    theme: { light: LEGEND_LIGHT, dark: LEGEND_DARK },
  },
} satisfies ChartConfig;

const points = new Intl.NumberFormat("en-US");
const WITHIN_A_DAY_MS = 36 * 60 * 60 * 1000;

type Row = {
  ms: number;
  rating?: number;
  rank?: number;
  battles?: number;
  played?: number;
  legend?: number | null;
};

/** The time axis, on a real time scale so a missed capture reads as a gap. */
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

/**
 * A player's climb, the bar they are climbing towards, and the battles that got
 * them there.
 *
 * The two lines share one scale by nature (both are rating points), which is
 * what makes the pairing worth drawing at all: the distance between them IS the
 * answer to "how far off Legend am I", and it moves on both sides at once, since
 * the cutoff is the top slice of a field that keeps playing.
 *
 * The bars are the third reading, and they are what turns a flat stretch of the
 * line from a mystery into a fact: no bars means they stopped playing, bars with
 * a flat line means a night that returned nothing.
 */
export function PlayerOnslaughtChart({
  climb,
  cutoffs,
  zone,
}: {
  climb: ClimbPoint[];
  cutoffs: CutoffPoint[];
  zone: DisplayZone;
}) {
  const data = useMemo(() => {
    const byInstant = new Map<number, Row>();
    for (const c of cutoffs) {
      byInstant.set(c.t, { ms: c.t * 1000, legend: c.legendPoints });
    }
    for (const p of climb) {
      const row = byInstant.get(p.t) ?? { ms: p.t * 1000 };
      row.rating = p.rating;
      row.rank = p.rank;
      row.battles = p.battles;
      byInstant.set(p.t, row);
    }
    const rows = [...byInstant.values()].sort((a, b) => a.ms - b.ms);

    // Carry the last known standing forward. The capture records a player only
    // at the instants they MOVED, so the absence of a row means their rating is
    // unchanged, not unknown: left as gaps, the line would stop dead at their
    // last battle and read as missing data on a player who is simply not playing
    // right now. Nothing is carried BACKWARD, since before their first row they
    // genuinely were not on the board.
    let carried: { rating?: number; rank?: number; battles?: number } | null =
      null;
    for (const row of rows) {
      if (row.rating != null) {
        carried = { rating: row.rating, rank: row.rank, battles: row.battles };
      } else if (carried) {
        row.rating = carried.rating;
        row.rank = carried.rank;
        row.battles = carried.battles;
      }
    }

    // Battles as the season's running total, on an axis of its own. The two
    // readings are not the same claim: the line is what the season is worth and
    // the bars are what it cost, so it is the gap between their slopes that
    // says something. A wall of bars under a flat line is a night that paid
    // nothing; a short step under a jump is a good one. The forward-fill above
    // is what makes a night off read as a plateau rather than as a gap.
    for (const row of rows) {
      if (row.battles != null) row.played = row.battles;
    }
    return rows;
  }, [climb, cutoffs]);

  const tick = useMemo(() => {
    const span = data.length >= 2 ? data[data.length - 1].ms - data[0].ms : 0;
    const fmt = new Intl.DateTimeFormat("en-US", {
      ...(span < WITHIN_A_DAY_MS
        ? { hour: "2-digit", minute: "2-digit", hour12: false }
        : { month: "short", day: "numeric" }),
      timeZone: zone === "local" ? undefined : "UTC",
    });
    return (value: number) => fmt.format(new Date(value));
  }, [data, zone]);

  const label = useMemo(
    () =>
      (_: React.ReactNode, payload: readonly { payload?: Row }[]) => {
        const row = payload?.[0]?.payload;
        if (row?.ms == null) return "";
        // The rank rides in the label rather than on an axis of its own: it is
        // a reading a player wants beside the points and it shares no scale
        // with them. Battles have their own axis, so the tooltip prints them
        // already.
        const parts = [formatMoment(new Date(row.ms), zone)];
        if (row.rank != null) parts.push(`rank #${row.rank}`);
        return parts.join(" · ");
      },
    [zone],
  );

  return (
    <figure className="border-t border-fd-border p-4">
      <figcaption className="mb-2 text-xs uppercase tracking-wide text-fd-muted-foreground">
        This season&apos;s climb
      </figcaption>
      <ChartContainer config={config} className="h-56 w-full">
        <ComposedChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <TimeAxis tick={tick} />
          <YAxis
            yAxisId="points"
            orientation="left"
            tickLine={false}
            axisLine={false}
            width={48}
            // Rating points sit in a narrow band well above zero, so the axis
            // frames the band it is drawing rather than the origin.
            domain={["dataMin - 40", "dataMax + 40"]}
            tickFormatter={(v: number) => points.format(v)}
          />
          {/* Battles get their own axis, on the right, because they are a
              count and the lines are a score: one scale each, each labelled, so
              a reader always knows which gutter a mark belongs to. It starts at
              zero, since a bar is read as a length and a truncated one lies
              about its size, and it runs past the data so the bars stay under
              the lines instead of covering them. */}
          <YAxis
            yAxisId="battles"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, (max: number) => Math.ceil(Math.max(1, max) * 1.6)]}
            tickFormatter={(v: number) => points.format(v)}
          />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={label} />} />
          <ChartLegend content={<ChartLegendContent />} />
          {/* Declared first so the lines draw over it, and held a little back so
              the curves stay the subject. Solid, the bars won the eye; at a
              third they were a wash. Just over half reads as a filled bar and
              still lets the dashed cutoff cross it legibly.
              A fixed width rather than one derived from the closest pair of
              samples, which is what recharts does by default on a time axis. A
              capture cadence is not perfectly even (a restart, a manual pass,
              a deploy), and derived widths turn one close pair into thin bars
              with gaps for the whole series. Fixed, the row stays even and a
              genuinely missing sample stays visible as a hole. */}
          <Bar
            yAxisId="battles"
            dataKey="played"
            fill="var(--color-played)"
            fillOpacity={0.55}
            barSize={14}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            yAxisId="points"
            dataKey="legend"
            stroke="var(--color-legend)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="points"
            dataKey="rating"
            stroke="var(--color-rating)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ChartContainer>
    </figure>
  );
}
