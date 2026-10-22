"use client";

import { useLocale } from "@onruntime/translations/react";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import {
  type ServerRecord,
  type ServerStats,
  type ServerStatsRange,
} from "@unicum.gg/shared";
import { type DisplayZone, formatMoment, formatPlayers } from "./format";
import { useDisplayZone } from "./use-display-zone";

/**
 * Whether this strip has anything at all to print.
 *
 * Exported because the panel around it draws a rule of its own, and a rule
 * over an empty strip is a stray line across the page. The caller and the
 * component have to agree on the answer, so there is one.
 */
export function hasServerRecords(stats: ServerStats): boolean {
  return Boolean(
    stats.peak || stats.trough || stats.allTimePeak || stats.average > 0,
  );
}

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
  const { locale } = useLocale();
  const { t } = useTranslation("components/servers/records");
  const { t: tRange } = useTranslation("components/servers/ranges");
  const label = tRange(range);
  const zone = useDisplayZone();

  // With not one of the four to show, the strip is its own rules and padding
  // around nothing, so it goes entirely. The panels around it say why.
  if (!hasServerRecords(stats)) return null;

  return (
    <dl className="flex flex-col divide-y divide-fd-border md:flex-row md:divide-x md:divide-y-0">
      <Cell title={t("peak-last", { label })} record={stats.peak} zone={zone} />
      <Cell title={t("low-last", { label })} record={stats.trough} zone={zone} />
      <Cell
        title={t("average-last", { label })}
        value={stats.average > 0 ? formatPlayers(stats.average, locale) : null}
        zone={zone}
      />
      <Cell title={t("all-time-record")} record={stats.allTimePeak} zone={zone} />
    </dl>
  );
}

/**
 * One figure, or nothing at all.
 *
 * A figure we do not have is left out rather than dashed: these carry their
 * own heading, so a dash under "Peak, last 24 hours" reads as a number that
 * broke, where an absent cell reads as a range with nothing in it. The row is
 * a flex strip rather than a fixed grid precisely so the survivors close
 * ranks, and with Wargaming's source down three of the four empty out
 * together while the all-time record still stands.
 */
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
  const { locale } = useFormat();
  const shown = value ?? (record ? formatPlayers(record.players, locale) : null);
  if (shown == null) return null;
  return (
    <div className="flex flex-1 flex-col gap-1 p-4">
      <dt className="text-xs uppercase tracking-wide text-fd-muted-foreground">
        {title}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">{shown}</dd>
      <dd className="text-xs text-fd-muted-foreground">
        {record ? formatMoment(record.at, zone, locale) : " "}
      </dd>
    </div>
  );
}
