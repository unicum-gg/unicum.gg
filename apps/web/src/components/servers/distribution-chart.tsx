"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  bucketIndexOf,
  type DistributionBucket,
  RATING_COLOR_HEX,
  type RatingColor,
} from "@unicum.gg/shared";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatPlayers, formatPlayersCompact } from "./format";

/**
 * A histogram of the region's players, coloured by the site's own rating bands.
 *
 * The bars carry the colour a value of theirs would wear anywhere else on the
 * site, so the shape reads as the population spread across the scale the reader
 * already knows rather than as an anonymous curve. The two outer buckets
 * collect everything past the plotted range and are labelled as such, since
 * drawing them as one step would claim a precision they do not have.
 */
export function DistributionChart({
  buckets,
  colorOf,
  formatEdge,
  ariaLabel,
  /** The reader's own value, marked on the axis when there is one. */
  marker,
  markerLabel,
}: {
  buckets: DistributionBucket[];
  colorOf: (value: number) => RatingColor;
  formatEdge: (value: number) => string;
  ariaLabel: string;
  marker?: number | null;
  markerLabel?: string;
}) {
  const total = useMemo(
    () => buckets.reduce((sum, b) => sum + b.count, 0),
    [buckets],
  );

  const data = useMemo(
    () =>
      buckets.map((bucket, i) => {
        const first = i === 0;
        const last = i === buckets.length - 1;
        return {
          // The bucket's own midpoint decides its colour, so a band boundary
          // falls between two bars instead of inside one.
          color: RATING_COLOR_HEX[colorOf((bucket.from + bucket.to) / 2)],
          label: first
            ? `<${formatEdge(bucket.to)}`
            : last
              ? `≥${formatEdge(bucket.from)}`
              : formatEdge(bucket.from),
          range: first
            ? `Below ${formatEdge(bucket.to)}`
            : last
              ? `${formatEdge(bucket.from)} and above`
              : `${formatEdge(bucket.from)} to ${formatEdge(bucket.to)}`,
          count: bucket.count,
          share: total > 0 ? bucket.count / total : 0,
        };
      }),
    [buckets, colorOf, formatEdge, total],
  );

  const markerLabelAt = useMemo(() => {
    if (marker == null || buckets.length === 0) return null;
    return data[bucketIndexOf(buckets, marker)]?.label ?? null;
  }, [marker, buckets, data]);

  const config = useMemo(
    () => ({ count: { label: "Players" } }) satisfies ChartConfig,
    [],
  );

  if (total === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-fd-muted-foreground">
        Nothing computed yet.
      </p>
    );
  }

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-64 w-full"
      aria-label={ariaLabel}
    >
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={formatPlayersCompact}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload?.range as string) ?? ""
              }
              formatter={(value, _name, item) => (
                <span>
                  {formatPlayers(Number(value))} players (
                  {((item?.payload?.share ?? 0) * 100).toFixed(1)}%)
                </span>
              )}
            />
          }
        />
        {markerLabelAt ? (
          <ReferenceLine
            x={markerLabelAt}
            stroke="var(--brand)"
            strokeWidth={2}
            label={{
              value: markerLabel ?? "You",
              position: "top",
              fill: "var(--brand)",
              fontSize: 11,
            }}
          />
        ) : null}
        <Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]}>
          {data.map((row) => (
            // Outlined in the border colour rather than in its own fill: the
            // scale's lowest band is black, which on a dark page is the page.
            // The same hairline on every bar keeps them a set rather than
            // singling one out.
            <Cell
              key={row.label}
              fill={row.color}
              stroke="var(--fd-border)"
              strokeWidth={1}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
