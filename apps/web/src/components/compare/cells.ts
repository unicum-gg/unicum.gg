import { numberFormat } from "@/lib/format";
import type { ReactNode } from "react";
import { type RatingColor, winrateColor } from "@unicum.gg/shared";

export type MetricKind = "higher" | "lower";

export type MetricCell = {
  display: string;
  displayNode?: ReactNode;
  numeric: number | null;
  color?: RatingColor | null;
};

export type MetricRow = {
  label: string;
  kind: MetricKind;
  cells: MetricCell[];
};

export const INT_FORMAT = {
  maximumFractionDigits: 0,
} as const;
export const DEC2_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
export const PCT_FORMAT = {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

export function dashCell(): MetricCell {
  return { display: "—", numeric: null };
}

export function numCell(
  value: number | null,
  locale: string,
  options: Intl.NumberFormatOptions = INT_FORMAT,
): MetricCell {
  if (value === null || !Number.isFinite(value)) return dashCell();
  return {
    display: numberFormat(locale, options).format(value),
    numeric: value,
  };
}

export function pctCell(num: number, denom: number, locale: string): MetricCell {
  if (denom <= 0) return dashCell();
  const ratio = num / denom;
  return {
    display: numberFormat(locale, PCT_FORMAT).format(ratio),
    numeric: ratio,
  };
}

export function winratePctCell(wins: number, battles: number, locale: string): MetricCell {
  if (battles <= 0) return dashCell();
  const ratio = wins / battles;
  return {
    display: numberFormat(locale, PCT_FORMAT).format(ratio),
    numeric: ratio,
    color: winrateColor(ratio),
  };
}

export function avgCell(
  num: number,
  denom: number,
  locale: string,
  options: Intl.NumberFormatOptions = INT_FORMAT,
): MetricCell {
  if (denom <= 0) return dashCell();
  const value = num / denom;
  return { display: numberFormat(locale, options).format(value), numeric: value };
}

export function ratingCell(
  value: number | null,
  color: (v: number) => RatingColor,
  locale: string,
  /** Wargaming's ratings are whole numbers and read wrong with two decimals. */
  format: Intl.NumberFormatOptions = DEC2_FORMAT,
): MetricCell {
  if (value === null) return dashCell();
  return {
    display: numberFormat(locale, format).format(value),
    numeric: value,
    color: color(value),
  };
}

/**
 * Which columns win a row, and the one rule every comparison on the site marks
 * its winner by.
 *
 * Two cases deliberately mark nothing, because in both of them nothing was won
 * and the ink would say otherwise:
 *
 * - **Fewer than two values to compare.** A column cannot beat a dash.
 * - **Every value ties.** Marking them all reads as "they all win", in exactly
 *   the same green as "this one wins", so a row the columns agree on looks like
 *   a row one of them took. It is not a rare case: two tier X heavies tie on a
 *   dozen rows, and two columns on the same vehicle tie on every row there is
 *   until one of their setups is touched.
 *
 * `same` compares at the precision the reader actually sees, so two values that
 * print the same number are the same value here whatever the storage says.
 */
export function bestOf(
  values: (number | null | undefined)[],
  options: {
    lowerBetter?: boolean;
    same?: (a: number, b: number) => boolean;
  } = {},
): Set<number> {
  const present = values
    .map((value, i) => ({ value, i }))
    .filter((e): e is { value: number; i: number } =>
      typeof e.value === "number" && Number.isFinite(e.value),
    );
  if (present.length < 2) return new Set();
  const best = present.reduce(
    (acc, e) => (options.lowerBetter ? Math.min(acc, e.value) : Math.max(acc, e.value)),
    present[0].value,
  );
  const same = options.same ?? ((a: number, b: number) => a === b);
  const winners = present.filter((e) => same(e.value, best));
  if (winners.length === present.length) return new Set();
  return new Set(winners.map((e) => e.i));
}

export function bestIndex(
  cells: MetricCell[],
  kind: MetricKind,
): Set<number> {
  return bestOf(
    cells.map((c) => c.numeric),
    { lowerBetter: kind === "lower" },
  );
}
