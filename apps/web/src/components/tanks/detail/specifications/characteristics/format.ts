import type { TankSpec } from "@unicum.gg/shared";
import type { Group, Row } from "./rows";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatSpecValue(value: number, digits?: number): string {
  if (digits === undefined) return intFmt.format(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function specValue(
  specs: TankSpec,
  row: Row,
  baseline: TankSpec | null,
): number | null {
  const raw = row.compute
    ? row.compute(specs, baseline)
    : row.key
      ? specs[row.key]
      : null;
  return typeof raw === "number" ? raw * (row.scale ?? 1) : null;
}

/** emerald when the value beats the baseline (respecting the row's direction),
 * red when worse, undefined when equal at display precision or not comparable.
 * Comparing at display precision avoids float32-storage noise lighting up a
 * value that shows the same number. */
export function deltaColor(
  value: number,
  baseline: number | null | undefined,
  row: Row,
): string | undefined {
  if (baseline == null || row.neutral) return undefined;
  const d = row.digits ?? 0;
  const a = Number(value.toFixed(d));
  const b = Number(baseline.toFixed(d));
  if (a === b) return undefined;
  const better = row.lowerBetter ? a < b : a > b;
  return better ? "text-emerald-500" : "text-red-500";
}

/** One column's characteristics: what it reads now, and the stock reference the
 * derived rows (effective speed and traverse) are computed against. */
export type SpecColumn = { specs: TankSpec | null; baseline: TankSpec | null };

/** Signed change against a reference, rounded to the row's display precision so
 * float32 storage noise never shows as a delta on a value that prints the same.
 * Null when there is nothing to compare, when the row has no direction
 * (`neutral`), or when the two are equal at that precision. */
export function rowDelta(
  value: number | null,
  reference: number | null | undefined,
  row: Row,
): number | null {
  if (value == null || reference == null || row.neutral) return null;
  const diff = Number((value - reference).toFixed(row.digits ?? 0));
  return diff === 0 ? null : diff;
}

/** The rows of a group that have nothing to show on any of the given columns, so
 * a sub-heading whose whole block is empty (turret armor on a casemate) drops
 * out with it, and a conditional row (the clip stats on a single-shot gun) drops
 * out rather than printing a dash. One column on a tank page, one per vehicle in
 * a comparison. */
export function hiddenRowIndexes(
  group: Group,
  columns: SpecColumn[],
): Set<number> {
  const allEmpty = (row: Row) =>
    columns.every(
      (c) => !c.specs || specValue(c.specs, row, c.baseline) == null,
    );
  const hidden = new Set<number>();
  group.rows.forEach((row, i) => {
    if (row.hideWhenEmpty && allEmpty(row)) hidden.add(i);
    if (!row.header) return;
    const subs: number[] = [];
    for (let j = i + 1; j < group.rows.length && group.rows[j].sub; j += 1)
      subs.push(j);
    if (subs.length > 0 && subs.every((k) => allEmpty(group.rows[k]))) {
      hidden.add(i);
      subs.forEach((k) => hidden.add(k));
    }
  });
  return hidden;
}
