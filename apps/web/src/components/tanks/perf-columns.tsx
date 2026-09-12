"use client";

import type { NumberFormatter } from "@/lib/format";

import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import type { TranslateFunction } from "@onruntime/translations";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TankStatsRow } from "@/components/tanks/list";
import { useCookie } from "@/hooks/use-cookie";
import { RatingMetric, RATING_COLOR_CLASS, winrateColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
import { useTranslation } from "@/hooks/use-translation";

const COLS_COOKIE = "unicum.perf_columns";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DEC2_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PCT1_FORMAT = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const;
const PCT2_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

/** Ids, not headings: the wording is in `components/tanks/perf-columns` under
 * `groups`, so the selector reads the same group in every language. */
export enum PerfGroup {
  General = "general",
  Combat = "combat",
}
export const PERF_GROUP_ORDER: PerfGroup[] = [PerfGroup.General, PerfGroup.Combat];

function ratingValue(s: TankStatsRow, metric: RatingMetric): number | null {
  if (metric === RatingMetric.Wn7) return s.wn7;
  if (metric === RatingMetric.Wn8) return s.wn8;
  return s.wnx;
}
function ratingColorClass(value: number, metric: RatingMetric): string {
  if (metric === RatingMetric.Wn7) return RATING_COLOR_CLASS[wn7Color(value)];
  if (metric === RatingMetric.Wn8) return RATING_COLOR_CLASS[wn8Color(value)];
  return RATING_COLOR_CLASS[wnxColor(value)];
}
export function metricLabel(metric: RatingMetric): string {
  return metric === RatingMetric.Wn7
    ? "WN7"
    : metric === RatingMetric.Wn8
      ? "WN8"
      : "WNX";
}

export type PerfCell = { node: ReactNode; className?: string };
export type PerfColumn = {
  key: string;
  group: PerfGroup;
  /** Whether this column explains itself on hover. The sentence is in the
   * locale file under `columns.<key>.tip`. */
  tipped?: boolean;
  defaultVisible: boolean;
  /** The rating column's header is the selected metric's own name, not a word
   * a translator writes. */
  metricHeaded?: boolean;
  /** `num` is passed in rather than read from a hook: this is a data table,
   * not a component, and the reader's number formatting has to reach it from
   * the component that renders it. */
  cell: (
    s: TankStatsRow | null,
    metric: RatingMetric,
    num: NumberFormatter,
  ) => PerfCell;
  sortValue: (s: TankStatsRow | null, metric: RatingMetric) => number | null;
};

/** A column's heading: the rating one names the metric, the rest read their
 * wording from `components/tanks/perf-columns`. */
export function perfColumnLabel(
  column: PerfColumn,
  metric: RatingMetric,
  t: TranslateFunction,
): string {
  return column.metricHeaded
    ? metricLabel(metric)
    : t(`columns.${column.key}.label`);
}

export const PERF_COLUMNS: PerfColumn[] = [
  {
    key: "battles",
    tipped: true,
    group: PerfGroup.General,
    defaultVisible: true,
    cell: (s, _metric, num) => ({ node: s?.battles != null ? num(INT_FORMAT).format(s.battles) : DASH }),
    sortValue: (s) => s?.battles ?? null,
  },
  {
    key: "count",
    tipped: true,
    group: PerfGroup.General,
    defaultVisible: true,
    cell: (s, _metric, num) => ({ node: s ? num(INT_FORMAT).format(s.players) : DASH }),
    sortValue: (s) => (s ? s.players : null),
  },
  {
    key: "rating",
    group: PerfGroup.General,
    defaultVisible: true,
    metricHeaded: true,
    cell: (s, m, num) => {
      const v = s ? ratingValue(s, m) : null;
      return {
        node: v != null ? num(INT_FORMAT).format(v) : DASH,
        className: v != null ? ratingColorClass(v, m) : undefined,
      };
    },
    sortValue: (s, m) => (s ? ratingValue(s, m) : null),
  },
  {
    key: "wr",
    tipped: true,
    group: PerfGroup.General,
    defaultVisible: true,
    cell: (s, _metric, num) => ({
      node: s ? `${num(PCT2_FORMAT).format(s.wr)}%` : DASH,
      className: s ? RATING_COLOR_CLASS[winrateColor(s.wr / 100)] : undefined,
    }),
    sortValue: (s) => s?.wr ?? null,
  },
  {
    key: "playerWr",
    tipped: true,
    group: PerfGroup.General,
    defaultVisible: true,
    cell: (s, _metric, num) => ({
      node: s?.playerWr != null ? `${num(PCT2_FORMAT).format(s.playerWr)}%` : DASH,
      className:
        s?.playerWr != null
          ? RATING_COLOR_CLASS[winrateColor(s.playerWr / 100)]
          : undefined,
    }),
    sortValue: (s) => s?.playerWr ?? null,
  },
  {
    key: "dpg",
    tipped: true,
    group: PerfGroup.Combat,
    defaultVisible: true,
    cell: (s, _metric, num) => ({ node: s ? num(INT_FORMAT).format(s.dpg) : DASH }),
    sortValue: (s) => s?.dpg ?? null,
  },
  {
    key: "kdr",
    tipped: true,
    group: PerfGroup.Combat,
    defaultVisible: false,
    cell: (s, _metric, num) => ({ node: s?.kdr != null ? num(DEC2_FORMAT).format(s.kdr) : DASH }),
    sortValue: (s) => s?.kdr ?? null,
  },
  {
    key: "assists",
    tipped: true,
    group: PerfGroup.Combat,
    defaultVisible: true,
    cell: (s, _metric, num) => ({ node: s?.assists != null ? num(INT_FORMAT).format(s.assists) : DASH }),
    sortValue: (s) => s?.assists ?? null,
  },
  {
    key: "hitPct",
    tipped: true,
    group: PerfGroup.Combat,
    defaultVisible: false,
    cell: (s, _metric, num) => ({ node: s?.hitPct != null ? `${num(PCT1_FORMAT).format(s.hitPct)}%` : DASH }),
    sortValue: (s) => s?.hitPct ?? null,
  },
  {
    key: "penPct",
    tipped: true,
    group: PerfGroup.Combat,
    defaultVisible: false,
    cell: (s, _metric, num) => ({ node: s?.penPct != null ? `${num(PCT1_FORMAT).format(s.penPct)}%` : DASH }),
    sortValue: (s) => s?.penPct ?? null,
  },
  {
    key: "spots",
    tipped: true,
    group: PerfGroup.Combat,
    defaultVisible: true,
    cell: (s, _metric, num) => ({ node: s?.spots != null ? num(DEC2_FORMAT).format(s.spots) : DASH }),
    sortValue: (s) => s?.spots ?? null,
  },
  {
    key: "blocked",
    tipped: true,
    group: PerfGroup.Combat,
    defaultVisible: false,
    cell: (s, _metric, num) => ({ node: s?.blocked != null ? num(INT_FORMAT).format(s.blocked) : DASH }),
    sortValue: (s) => s?.blocked ?? null,
  },
  {
    key: "survival",
    tipped: true,
    group: PerfGroup.Combat,
    defaultVisible: false,
    cell: (s, _metric, num) => ({ node: s?.survival != null ? `${num(PCT1_FORMAT).format(s.survival)}%` : DASH }),
    sortValue: (s) => s?.survival ?? null,
  },
];

export const PERF_COLUMN_BY_KEY: Record<string, PerfColumn> = Object.fromEntries(
  PERF_COLUMNS.map((c) => [c.key, c]),
);
const DEFAULT_PERF_KEYS = PERF_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.key,
);

// Cookie-backed set of visible perf-column keys, shared between the selector
// (in the filter bar) and the table via useCookie's broadcast.
export function usePerfColumns(): [Set<string>, (key: string) => void] {
  const [raw, setRaw] = useCookie(COLS_COOKIE, DEFAULT_PERF_KEYS.join(","));
  const selected = useMemo(() => {
    const set = new Set(raw.split(",").filter((k) => PERF_COLUMN_BY_KEY[k]));
    return set.size > 0 ? set : new Set(DEFAULT_PERF_KEYS);
  }, [raw]);
  const toggle = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setRaw(
        PERF_COLUMNS.filter((c) => next.has(c.key))
          .map((c) => c.key)
          .join(","),
      );
    },
    [selected, setRaw],
  );
  return [selected, toggle];
}

export function PerfColumnSelector() {
  const { t } = useTranslation("components/tanks/perf-columns");
  const [selected, onToggle] = usePerfColumns();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-fd-border px-3 text-xs font-medium transition-colors hover:bg-fd-secondary/40"
      >
        <SlidersHorizontalIcon weight="bold" className="size-3.5" />
        {t("columns-label")}
        <span className="text-fd-muted-foreground">
          {selected.size}/{PERF_COLUMNS.length}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-96 w-56 overflow-y-auto rounded-lg border border-fd-border bg-fd-popover p-2 shadow-lg">
          {PERF_GROUP_ORDER.map((group) => (
            <div key={group} className="mb-2 last:mb-0">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-fd-muted-foreground">
                {t(`groups.${group}`)}
              </div>
              {PERF_COLUMNS.filter((c) => c.group === group).map((c) => (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-fd-secondary/40"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.key)}
                    onChange={() => onToggle(c.key)}
                    className="size-3.5 accent-brand"
                  />
                  <span>{t(`columns.${c.key}.label`)}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
