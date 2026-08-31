"use client";

import {
  SERVER_STATS_RANGE_LABEL,
  type ServerRecord,
  type ServerStats,
  type ServerStatsRange,
} from "@unicum.gg/shared";
import { type DisplayZone, formatMoment, formatPlayers } from "./format";
import { useDisplayZone } from "./use-display-zone";

/**
 * The four figures that summarise a range: its high, its low, its mean, and the
 * highest total ever recorded.
 *
 * The all-time record sits beside the other three rather than in its own panel
 * because for the first weeks it will be the same number as the range's peak,
 * and putting them side by side makes that obvious instead of looking like two
 * unrelated claims.
 *
 * Cells divided by rules, the shape /coverage gives its refresh queues: the
 * boxes come from `divide-*`, so the row carries no background of its own and
 * cannot end up a shade off the panel holding it, which is exactly what a grid
 * faking its rules with `gap-px` over a coloured parent did here.
 */
export function ServerRecords({
  stats,
  range,
}: {
  stats: ServerStats;
  range: ServerStatsRange;
}) {
  const label = SERVER_STATS_RANGE_LABEL[range];
  const zone = useDisplayZone();
  return (
    <dl className="flex flex-col divide-y divide-fd-border md:flex-row md:divide-x md:divide-y-0">
      <Cell title={`Peak, last ${label}`} record={stats.peak} zone={zone} />
      <Cell title={`Low, last ${label}`} record={stats.trough} zone={zone} />
      <Cell
        title={`Average, last ${label}`}
        value={stats.average > 0 ? formatPlayers(stats.average) : null}
        zone={zone}
      />
      <Cell title="All-time record" record={stats.allTimePeak} zone={zone} />
    </dl>
  );
}

function Cell({
  title,
  record,
  value,
  zone,
}: {
  title: string;
  record?: ServerRecord | null;
  value?: string | null;
  zone: DisplayZone;
}) {
  const shown = value ?? (record ? formatPlayers(record.players) : null);
  return (
    <div className="flex flex-1 flex-col gap-1 p-4">
      <dt className="text-xs uppercase tracking-wide text-fd-muted-foreground">
        {title}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">{shown ?? "—"}</dd>
      <dd className="text-xs text-fd-muted-foreground">
        {record ? formatMoment(record.at, zone) : " "}
      </dd>
    </div>
  );
}
