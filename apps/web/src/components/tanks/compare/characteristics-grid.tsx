"use client";

import type { ReactNode } from "react";
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import type { TankSpec } from "@unicum.gg/shared";
import type { SpecRanges } from "@unicum.gg/core/wargaming/wot/tanks/spec-ranges";
import { CurrencyIcon } from "@/components/tanks/currency-icon";
import {
  GROUPS,
  type Group,
  type Row,
} from "@/components/tanks/detail/specifications/characteristics/rows";
import {
  deltaColor,
  formatSpecValue,
  hiddenRowIndexes,
  rowDelta,
  specValue,
  type SpecColumn,
} from "@/components/tanks/detail/specifications/characteristics/format";
import { categoryScore, MAX_SCORE } from "@/components/tanks/compare/score";
import { cn } from "@/lib/utils";

/** A column of the comparison, the same shape a tank page's own table reads. */
export type CompareColumnSpecs = SpecColumn;

/** The indices holding the best value of a row, respecting its direction.
 * Everything ties on a neutral row (nothing to win), so nothing is marked. */
function bestIndices(values: (number | null)[], row: Row): Set<number> {
  if (row.neutral) return new Set();
  const present = values
    .map((v, i) => ({ v, i }))
    .filter((e): e is { v: number; i: number } => e.v != null);
  if (present.length < 2) return new Set();
  const best = present.reduce(
    (acc, e) => (row.lowerBetter ? Math.min(acc, e.v) : Math.max(acc, e.v)),
    present[0].v,
  );
  // Compared at display precision: two values that print the same number are the
  // same value here, whatever the float32 storage says.
  const d = row.digits ?? 0;
  const same = (a: number, b: number) => a.toFixed(d) === b.toFixed(d);
  return new Set(present.filter((e) => same(e.v, best)).map((e) => e.i));
}

function ValueCell({
  value,
  row,
  specs,
  isBest,
  reference,
}: {
  value: number | null;
  row: Row;
  specs: TankSpec | null;
  isBest: boolean;
  /** The pinned column's value for this row, or null on the pinned column
   * itself and when nothing is pinned. */
  reference: number | null;
}) {
  if (value == null) {
    return <span className="text-fd-muted-foreground">—</span>;
  }
  // Same delta and same colouring the tank page shows against stock, read
  // against the pinned column instead.
  const delta = rowDelta(value, reference, row);
  const secondary = row.secondary ? specs?.[row.secondary] : null;
  return (
    <span className="inline-flex items-baseline justify-end gap-1.5 whitespace-nowrap">
      {delta != null && (
        <span
          className={cn(
            "inline-flex items-center text-[0.6875rem]",
            deltaColor(value, reference, row),
          )}
        >
          {delta > 0 ? "+" : ""}
          {formatSpecValue(delta, row.digits)}
          {delta > 0 ? (
            <TrendUpIcon className="size-3" weight="bold" />
          ) : (
            <TrendDownIcon className="size-3" weight="bold" />
          )}
        </span>
      )}
      <span className={cn("font-medium", isBest && "text-emerald-500")}>
        {formatSpecValue(value, row.digits)}
        {typeof secondary === "number" && (
          <span className="text-fd-muted-foreground/70">
            {" / "}
            {formatSpecValue(secondary, row.digits)}
          </span>
        )}
        {row.currency ? (
          <CurrencyIcon
            type={row.currency}
            className="ml-1 inline-block h-3 w-auto translate-y-px text-fd-muted-foreground"
          />
        ) : row.unit ? (
          <span className="ml-0.5 text-xs text-fd-muted-foreground">
            {row.unit}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * The comparison itself: the game's Compare Vehicles table, one column per
 * vehicle over the same characteristics the tank page lists.
 *
 * Every column reads a live build, so a mounted rammer or a trained crew moves
 * the numbers here exactly as it does on a tank page. Rows carry their own sense
 * of better (a lower reload wins, a bigger caliber wins nothing), which is what
 * marks the best value; the pinned column turns the others into differences
 * against it, the way the game shows a delta against the vehicle you picked.
 */
export function TankCompareGrid({
  columns,
  ranges,
  pinned,
  headers,
  labelWidth = "12rem",
}: {
  columns: CompareColumnSpecs[];
  ranges: SpecRanges;
  /** Index of the reference column, or null to show plain values everywhere. */
  pinned: number | null;
  /** One header cell per column, built by the caller (it holds the builds). */
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
          {columns.map((_, i) => (
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
        {GROUPS.map((group) => (
          <SpecGroupRows
            key={group.title}
            group={group}
            columns={columns}
            ranges={ranges}
            pinned={pinned}
          />
        ))}
      </table>
    </div>
  );
}

function SpecGroupRows({
  group,
  columns,
  ranges,
  pinned,
}: {
  group: Group;
  columns: CompareColumnSpecs[];
  ranges: SpecRanges;
  pinned: number | null;
}) {
  const hidden = hiddenRowIndexes(group, columns);
  const scores = columns.map((c) => categoryScore(c.specs, group, ranges));
  const bestScore = Math.max(...scores.map((s) => s ?? -1));

  return (
    <tbody className="border-b border-fd-border last:border-b-0">
      <tr className="border-b border-fd-border bg-fd-secondary/30">
        <th className="sticky left-0 bg-fd-secondary px-4 py-2 text-left text-sm font-semibold tracking-wide uppercase">
          {group.title}
        </th>
        {scores.map((score, i) => (
          <td
            key={i}
            className="border-l border-fd-border px-3 py-2 text-right tabular-nums"
            title={`Where this vehicle sits in the catalogue on ${group.title.toLowerCase()}, out of ${MAX_SCORE}`}
          >
            {score == null ? (
              <span className="text-fd-muted-foreground">—</span>
            ) : (
              <span
                className={cn(
                  "font-semibold",
                  score === bestScore && columns.length > 1 && "text-emerald-500",
                )}
              >
                {score}
              </span>
            )}
          </td>
        ))}
      </tr>
      {group.rows.map((row, index) => {
        if (hidden.has(index)) return null;
        if (row.header) {
          return (
            <tr key={index} className="border-b border-fd-border/60">
              <th
                colSpan={columns.length + 1}
                className="px-4 pt-2 pb-1 text-left text-sm font-medium"
              >
                {/* A cell spanning the whole row has no room to stick, so the
                    label inside it is what stays put on a sideways scroll. */}
                <span className="sticky left-4 inline-block">{row.label}</span>
              </th>
            </tr>
          );
        }
        const values = columns.map((c) =>
          c.specs ? specValue(c.specs, row, c.baseline) : null,
        );
        const best = bestIndices(values, row);
        const reference = pinned != null ? values[pinned] : null;
        return (
          <tr
            key={index}
            className="border-b border-fd-border/60 last:border-b-0 hover:bg-fd-secondary/20"
          >
            {/* Sticky, so the characteristic being read stays on screen while
                the columns scroll sideways on a narrow display. */}
            <td
              className={cn(
                "sticky left-0 bg-fd-background px-4 py-1.5 text-fd-muted-foreground",
                row.sub && "pl-7 text-fd-muted-foreground/75",
              )}
            >
              {row.label}
            </td>
            {values.map((value, i) => {
              const isPinned = pinned === i;
              return (
                <td
                  key={i}
                  className={cn(
                    "border-l border-fd-border px-3 py-1.5 text-right tabular-nums",
                    isPinned && "bg-fd-secondary/20",
                  )}
                >
                  <ValueCell
                    value={value}
                    row={row}
                    specs={columns[i].specs}
                    isBest={best.has(i)}
                    reference={isPinned ? null : reference}
                  />
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
}
