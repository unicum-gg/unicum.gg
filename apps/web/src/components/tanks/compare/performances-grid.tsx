"use client";

import type { ReactNode } from "react";
import { RATING_COLOR_CLASS } from "@unicum.gg/shared";
import type { CompareVehicle } from "@unicum.gg/core/wargaming/wot/tanks/compare-assemble";
import { bestIndex } from "@/components/compare/cells";
import { PERFORMANCE_GROUPS } from "@/components/tanks/compare/performances-rows";
import { cn } from "@/lib/utils";

/**
 * The comparison's second reading: the same columns, measured on the servers
 * rather than in the client's files.
 *
 * Marks are "lower is better" on purpose: a threshold you have to reach is
 * easier on the vehicle that asks for less damage, so the smallest number wins
 * the row.
 */
export function TankComparePerformancesGrid({
  vehicles,
  headers,
  labelWidth = "12rem",
}: {
  vehicles: CompareVehicle[];
  headers: ReactNode[];
  labelWidth?: string;
}) {
  // The horizontal scroll is only offered where it is needed (narrow screens):
  // a scroll container becomes the sticky header's containing block, so from
  // `lg`, where the table fits, the page itself scrolls and the vehicles stay in
  // view as the characteristics go by.
  return (
    <div className="overflow-x-auto lg:overflow-x-visible">
      <table className="screen-line-after-cell w-full min-w-2xl table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: labelWidth }} />
          {vehicles.map((_, i) => (
            <col key={i} />
          ))}
        </colgroup>
        {/* The vehicles follow the scroll: a full characteristics table is far
            taller than a screen, and a number means nothing once the column it
            belongs to has scrolled off. */}
        {/* The background sits on the cells, not on `thead`: a table section's
            own background is painted under the cells, so a scrolled row would
            show through the sticky header. */}
        <thead className="sticky top-14 z-20">
          <tr className="border-b border-fd-border align-top">
            <th className="sticky left-0 bg-fd-background p-0" />
            {/* The column rule is an inset shadow rather than a border: with
                `border-collapse` a border belongs to the table, not the cell, so
                the cell background does not extend under it and the coloured
                rows scrolling beneath this sticky header showed straight through
                the translucent line. */}
            {headers.map((header, i) => (
              <th
                key={i}
                className="bg-fd-background p-0 text-left font-normal shadow-[inset_1px_0_0_var(--color-fd-border)]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        {PERFORMANCE_GROUPS.map((group) => (
          <tbody
            key={group.title}
            className="border-b border-fd-border last:border-b-0"
          >
            <tr className="border-b border-fd-border bg-fd-secondary/30">
              <th
                colSpan={vehicles.length + 1}
                className="px-4 py-2 text-left text-sm font-semibold tracking-wide uppercase"
              >
                {/* A cell spanning the whole row has no room to stick, so the
                    title inside it is what stays put on a sideways scroll. */}
                <span className="sticky left-4 inline-block">{group.title}</span>
              </th>
            </tr>
            {group.rows.map((row) => {
              const values = vehicles.map((v) => row.value(v));
              const best = row.kind
                ? bestIndex(
                    values.map((v) => ({ display: "", numeric: v })),
                    row.kind,
                  )
                : new Set<number>();
              return (
                <tr
                  key={row.label}
                  className="border-b border-fd-border/60 last:border-b-0 hover:bg-fd-secondary/20"
                >
                  <td className="sticky left-0 bg-fd-background px-4 py-1.5 text-fd-muted-foreground">
                    {row.label}
                  </td>
                  {values.map((value, i) => {
                    // The rating colour dresses the whole cell, as it does in
                    // every table on the site: a rating is read as a band of
                    // colour down a column, not as a tinted word.
                    const color =
                      value != null && row.color ? row.color(value) : null;
                    const isBest = best.has(i) && values.length > 1;
                    return (
                      <td
                        key={i}
                        className={cn(
                          "border-l border-fd-border px-3 py-1.5 text-right font-medium tabular-nums",
                          color
                            ? RATING_COLOR_CLASS[color]
                            : value == null
                              ? "font-normal text-fd-muted-foreground"
                              : // Without a rating scale of its own, the best
                                // value of the row is marked the way the
                                // characteristics are.
                                isBest && "text-emerald-500",
                        )}
                      >
                        {value == null ? "—" : row.format(value)}
                        {/* On a coloured cell the green would be invisible, so
                            the winner keeps the dot the other comparisons use. */}
                        {color && isBest && (
                          <span
                            aria-hidden
                            className="ms-1 inline-block size-1.5 rounded-full bg-white/90 align-middle"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
