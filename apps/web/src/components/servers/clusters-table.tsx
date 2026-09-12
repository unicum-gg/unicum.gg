"use client";

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import {
  type ServerClusterStat,
  serverDisplayName,
  type ServerRecord,
  type ServerStatsRange,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { formatMoment, formatPlayers, formatShare } from "./format";
import { useDisplayZone } from "./use-display-zone";

/**
 * Every cluster the region reported, in its own order rather than by
 * population: the labels name servers now, so listing EU2 above EU1 because it
 * happened to be busier would read as a broken sort. Who is busiest is the
 * Online column's job.
 *
 * A plain table with the padding on its cells, the shape /coverage gives its
 * own panel tables, so the rows run edge to edge and their rules meet the
 * panel's borders. The shared `Table` primitive is built for the page flow
 * instead (it negates the page padding and re-applies it inside), which inset
 * the whole thing from the panel it sits in.
 */
export function ClustersTable({
  clusters,
  range,
  region,
  total,
  peak,
  average,
}: {
  clusters: ServerClusterStat[];
  range: ServerStatsRange;
  region: Region;
  /** The region's own figures for the total row. They are read from the region
   * series rather than summed down the columns: a peak is a moment, and the
   * clusters do not peak at the same one, so adding their records invents an
   * instant that never happened, a few thousand players above the real high on
   * a normal EU day. The average survives the addition, being linear, but is
   * taken from the same place so the row has one provenance rather than two. */
  total: number | null;
  peak: ServerRecord | null;
  average: number;
}) {
  const { locale } = useFormat();
  const { t } = useTranslation("components/servers/clusters-table");
  // Before the early return: a hook must run on every render of this component,
  // and an empty cluster list is one of them.
  const zone = useDisplayZone();
  const { t: tRange } = useTranslation("components/servers/ranges");

  if (clusters.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-fd-muted-foreground">
        {t("no-cluster-recorded-yet")}</p>
    );
  }

  const label = tRange(range);
  const rows = [...clusters].sort((a, b) =>
    serverDisplayName(region, a.server).localeCompare(
      serverDisplayName(region, b.server),
      "en",
      { numeric: true },
    ),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-fd-border text-xs uppercase tracking-wide text-fd-muted-foreground">
            <th className="px-4 py-2 text-left font-medium">{t("server")}</th>
            <th className="px-4 py-2 text-right font-medium">{t("online")}</th>
            <th className="px-4 py-2 text-right font-medium">{t("share")}</th>
            <th className="px-4 py-2 text-right font-medium">{t("peak", { label })}</th>
            <th className="px-4 py-2 text-right font-medium">
              {t("average", { label })}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((cluster) => (
            <tr
              key={cluster.server}
              className="border-b border-fd-border last:border-b-0"
            >
              {/* The identifier stays in reach on hover: the label is ours,
                  the identifier is Wargaming's. */}
              <td className="px-4 py-2 font-medium" title={cluster.server}>
                {serverDisplayName(region, cluster.server)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {cluster.current == null ? (
                  // Absent from the last sample. Wargaming stops listing a
                  // cluster it has taken down rather than reporting it at zero,
                  // so an empty cell is the honest reading, not "0 players".
                  <span className="text-fd-muted-foreground" title={t("not-reported")}>
                    —
                  </span>
                ) : (
                  formatPlayers(cluster.current, locale)
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
                {cluster.share > 0 ? formatShare(cluster.share, locale) : "—"}
              </td>
              <td
                className="px-4 py-2 text-right tabular-nums"
                title={cluster.peakAt ? formatMoment(cluster.peakAt, zone, locale) : undefined}
              >
                {formatPlayers(cluster.peak, locale)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
                {formatPlayers(cluster.average, locale)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-fd-border font-medium">
            <td className="px-4 py-2">{t("total")}</td>
            <td className="px-4 py-2 text-right tabular-nums">
              {total == null ? (
                <span className="text-fd-muted-foreground" title={t("not-reported")}>
                  —
                </span>
              ) : (
                formatPlayers(total, locale)
              )}
            </td>
            {/* The region is all of itself. Shown rather than left blank so the
                column reads as shares of a whole that is named. */}
            <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
              {total == null ? "—" : formatShare(1, locale)}
            </td>
            <td
              className="px-4 py-2 text-right tabular-nums"
              title={peak?.at ? formatMoment(peak.at, zone, locale) : undefined}
            >
              {peak == null ? "—" : formatPlayers(peak.players, locale)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
              {formatPlayers(average, locale)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
