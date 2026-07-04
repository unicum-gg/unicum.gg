import type { ReactNode } from "react";
import { type RatingColor, winrateColor } from "@unicum.gg/core/wargaming/wot/ratings";

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

export const intFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
export const dec2Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function dashCell(): MetricCell {
  return { display: "—", numeric: null };
}

export function numCell(
  value: number | null,
  fmt: Intl.NumberFormat,
): MetricCell {
  if (value === null || !Number.isFinite(value)) return dashCell();
  return { display: fmt.format(value), numeric: value };
}

export function pctCell(num: number, denom: number): MetricCell {
  if (denom <= 0) return dashCell();
  const ratio = num / denom;
  return {
    display: pctFmt.format(ratio),
    numeric: ratio,
  };
}

export function winratePctCell(wins: number, battles: number): MetricCell {
  if (battles <= 0) return dashCell();
  const ratio = wins / battles;
  return {
    display: pctFmt.format(ratio),
    numeric: ratio,
    color: winrateColor(ratio),
  };
}

export function avgCell(
  num: number,
  denom: number,
  fmt: Intl.NumberFormat = intFmt,
): MetricCell {
  if (denom <= 0) return dashCell();
  const value = num / denom;
  return { display: fmt.format(value), numeric: value };
}

export function ratingCell(
  value: number | null,
  color: (v: number) => RatingColor,
): MetricCell {
  if (value === null) return dashCell();
  return {
    display: dec2Fmt.format(value),
    numeric: value,
    color: color(value),
  };
}

export function bestIndex(
  cells: MetricCell[],
  kind: MetricKind,
): Set<number> {
  const numerics: { idx: number; value: number }[] = [];
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i].numeric;
    if (v === null) continue;
    numerics.push({ idx: i, value: v });
  }
  if (numerics.length === 0) return new Set();
  numerics.sort((a, b) =>
    kind === "higher" ? b.value - a.value : a.value - b.value,
  );
  const bestValue = numerics[0].value;
  return new Set(
    numerics.filter((n) => n.value === bestValue).map((n) => n.idx),
  );
}
