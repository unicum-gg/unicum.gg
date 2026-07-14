"use client";

import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TankStatsRow } from "@/components/tanks/tanks-index";
import { useCookie } from "@/hooks/use-cookie";
import { RatingMetric, RATING_COLOR_CLASS, winrateColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";

const COLS_COOKIE = "unicum.perf_columns";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dec2Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct1Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const pct2Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

export enum PerfGroup {
  General = "General",
  Combat = "Combat",
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
  label: string;
  group: PerfGroup;
  tip?: string;
  defaultVisible: boolean;
  // The rating column's header follows the selected metric.
  header?: (metric: RatingMetric) => string;
  cell: (s: TankStatsRow | null, metric: RatingMetric) => PerfCell;
  sortValue: (s: TankStatsRow | null, metric: RatingMetric) => number | null;
};

export const PERF_COLUMNS: PerfColumn[] = [
  {
    key: "battles",
    label: "Battles",
    group: PerfGroup.General,
    tip: "Total games played on the tank",
    defaultVisible: true,
    cell: (s) => ({ node: s?.battles != null ? intFmt.format(s.battles) : DASH }),
    sortValue: (s) => s?.battles ?? null,
  },
  {
    key: "count",
    label: "Count",
    group: PerfGroup.General,
    tip: "Number of tracked players in the sample",
    defaultVisible: true,
    cell: (s) => ({ node: s ? intFmt.format(s.players) : DASH }),
    sortValue: (s) => (s ? s.players : null),
  },
  {
    key: "rating",
    label: "Rating (WN)",
    group: PerfGroup.General,
    defaultVisible: true,
    header: (m) => metricLabel(m),
    cell: (s, m) => {
      const v = s ? ratingValue(s, m) : null;
      return {
        node: v != null ? intFmt.format(v) : DASH,
        className: v != null ? ratingColorClass(v, m) : undefined,
      };
    },
    sortValue: (s, m) => (s ? ratingValue(s, m) : null),
  },
  {
    key: "wr",
    label: "WR",
    group: PerfGroup.General,
    tip: "Win rate on the tank",
    defaultVisible: true,
    cell: (s) => ({
      node: s ? `${pct2Fmt.format(s.wr)}%` : DASH,
      className: s ? RATING_COLOR_CLASS[winrateColor(s.wr / 100)] : undefined,
    }),
    sortValue: (s) => s?.wr ?? null,
  },
  {
    key: "playerWr",
    label: "Player WR",
    group: PerfGroup.General,
    tip: "Average overall win rate of players who drive it",
    defaultVisible: true,
    cell: (s) => ({
      node: s?.playerWr != null ? `${pct2Fmt.format(s.playerWr)}%` : DASH,
      className:
        s?.playerWr != null
          ? RATING_COLOR_CLASS[winrateColor(s.playerWr / 100)]
          : undefined,
    }),
    sortValue: (s) => s?.playerWr ?? null,
  },
  {
    key: "dpg",
    label: "DPG",
    group: PerfGroup.Combat,
    tip: "Average damage per game",
    defaultVisible: true,
    cell: (s) => ({ node: s ? intFmt.format(s.dpg) : DASH }),
    sortValue: (s) => s?.dpg ?? null,
  },
  {
    key: "kdr",
    label: "KDR",
    group: PerfGroup.Combat,
    tip: "Kills / deaths ratio",
    defaultVisible: false,
    cell: (s) => ({ node: s?.kdr != null ? dec2Fmt.format(s.kdr) : DASH }),
    sortValue: (s) => s?.kdr ?? null,
  },
  {
    key: "assists",
    label: "Assists",
    group: PerfGroup.Combat,
    tip: "Average assisted damage",
    defaultVisible: true,
    cell: (s) => ({ node: s?.assists != null ? intFmt.format(s.assists) : DASH }),
    sortValue: (s) => s?.assists ?? null,
  },
  {
    key: "hitPct",
    label: "Hit %",
    group: PerfGroup.Combat,
    tip: "Hits / shots",
    defaultVisible: false,
    cell: (s) => ({ node: s?.hitPct != null ? `${pct1Fmt.format(s.hitPct)}%` : DASH }),
    sortValue: (s) => s?.hitPct ?? null,
  },
  {
    key: "penPct",
    label: "Pen %",
    group: PerfGroup.Combat,
    tip: "Penetrations / hits",
    defaultVisible: false,
    cell: (s) => ({ node: s?.penPct != null ? `${pct1Fmt.format(s.penPct)}%` : DASH }),
    sortValue: (s) => s?.penPct ?? null,
  },
  {
    key: "spots",
    label: "Spots",
    group: PerfGroup.Combat,
    tip: "Average spots per game",
    defaultVisible: true,
    cell: (s) => ({ node: s?.spots != null ? dec2Fmt.format(s.spots) : DASH }),
    sortValue: (s) => s?.spots ?? null,
  },
  {
    key: "blocked",
    label: "Blocked",
    group: PerfGroup.Combat,
    tip: "Average damage blocked by armor",
    defaultVisible: false,
    cell: (s) => ({ node: s?.blocked != null ? intFmt.format(s.blocked) : DASH }),
    sortValue: (s) => s?.blocked ?? null,
  },
  {
    key: "survival",
    label: "Survival",
    group: PerfGroup.Combat,
    tip: "Share of battles survived",
    defaultVisible: false,
    cell: (s) => ({ node: s?.survival != null ? `${pct1Fmt.format(s.survival)}%` : DASH }),
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
        Columns
        <span className="text-fd-muted-foreground">
          {selected.size}/{PERF_COLUMNS.length}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-96 w-56 overflow-y-auto rounded-lg border border-fd-border bg-fd-popover p-2 shadow-lg">
          {PERF_GROUP_ORDER.map((group) => (
            <div key={group} className="mb-2 last:mb-0">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-fd-muted-foreground">
                {group}
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
                    className="size-3.5 accent-[#f25322]"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
