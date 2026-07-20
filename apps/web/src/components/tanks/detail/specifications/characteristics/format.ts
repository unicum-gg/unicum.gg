import type { TankSpec } from "@unicum.gg/shared";
import type { Row } from "./rows";

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
