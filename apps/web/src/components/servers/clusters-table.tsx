"use client";

import {
  SERVER_STATS_RANGE_LABEL,
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
  // Before the early return: a hook must run on every render of this component,
  // and an empty cluster list is one of them.
  const zone = useDisplayZone();

  if (clusters.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-fd-muted-foreground">
        No cluster recorded yet.
      </p>
    );
  }

  const label = SERVER_STATS_RANGE_LABEL[range];
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
            <th className="px-4 py-2 text-left font-medium">Server</th>
            <th className="px-4 py-2 text-right font-medium">Online</th>
            <th className="px-4 py-2 text-right font-medium">Share</th>
            <th className="px-4 py-2 text-right font-medium">Peak ({label})</th>
            <th className="px-4 py-2 text-right font-medium">
              Average ({label})
            </th>
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
                  <span className="text-fd-muted-foreground" title="Not reported">
                    —
                  </span>
                ) : (
                  formatPlayers(cluster.current)
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
                {cluster.share > 0 ? formatShare(cluster.share) : "—"}
              </td>
              <td
                className="px-4 py-2 text-right tabular-nums"
                title={cluster.peakAt ? formatMoment(cluster.peakAt, zone) : undefined}
              >
                {formatPlayers(cluster.peak)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
                {formatPlayers(cluster.average)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-fd-border font-medium">
            <td className="px-4 py-2">Total</td>
            <td className="px-4 py-2 text-right tabular-nums">
              {total == null ? (
                <span className="text-fd-muted-foreground" title="Not reported">
                  —
                </span>
              ) : (
                formatPlayers(total)
              )}
            </td>
            {/* The region is all of itself. Shown rather than left blank so the
                column reads as shares of a whole that is named. */}
            <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
              {total == null ? "—" : formatShare(1)}
            </td>
            <td
              className="px-4 py-2 text-right tabular-nums"
              title={peak?.at ? formatMoment(peak.at, zone) : undefined}
            >
              {peak == null ? "—" : formatPlayers(peak.players)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
              {formatPlayers(average)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
