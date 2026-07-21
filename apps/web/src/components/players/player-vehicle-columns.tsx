"use client";

import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MOE_COLORS, MoEIcon } from "@/components/tanks/moe-icon";
import { MoMIcon } from "@/components/tanks/mom-icon";
import { metricLabel } from "@/components/tanks/perf-columns";
import { useCookie } from "@/hooks/use-cookie";
import { RatingMetric, RATING_COLOR_CLASS, winrateColor, wn7Color, wn8Color, wnxColor, type PlayerTankRow } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const COLS_COOKIE = "unicum.player_vehicle_columns";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dec2Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct2Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

export function ratingForMetric(
  row: PlayerTankRow,
  metric: RatingMetric,
): number | null {
  if (metric === RatingMetric.Wn7) return row.wn7;
  if (metric === RatingMetric.Wn8) return row.wn8;
  return row.wnx;
}

function ratingColorClass(value: number, metric: RatingMetric): string {
  if (metric === RatingMetric.Wn7) return RATING_COLOR_CLASS[wn7Color(value)];
  if (metric === RatingMetric.Wn8) return RATING_COLOR_CLASS[wn8Color(value)];
  return RATING_COLOR_CLASS[wnxColor(value)];
}

export type PlayerCellCtx = { region: Region; metric: RatingMetric };
export type PlayerCell = { node: ReactNode; className?: string };
export type PlayerColumn = {
  key: string;
  label: string;
  tip?: string;
  align: "center" | "end";
  defaultVisible: boolean;
  hideOnMobile?: boolean;
  // The rating column's header follows the selected metric.
  header?: (metric: RatingMetric) => string;
  cell: (r: PlayerTankRow, ctx: PlayerCellCtx) => PlayerCell;
  sortValue: (r: PlayerTankRow, metric: RatingMetric) => number;
};

export const PLAYER_COLUMNS: PlayerColumn[] = [
  {
    key: "mastery",
    label: "Mastery",
    align: "center",
    defaultVisible: true,
    hideOnMobile: true,
    cell: (r) => {
      const m = r.mom;
      if (!m || m < 1 || m > 4) return { node: DASH };
      return { node: <MoMIcon mastery={m as 1 | 2 | 3 | 4} /> };
    },
    sortValue: (r) => r.mom ?? -1,
  },
  {
    key: "marks",
    label: "Marks",
    tip: "Marks of Excellence earned on the gun",
    align: "center",
    defaultVisible: true,
    hideOnMobile: true,
    cell: (r) => {
      const marks = r.moe;
      if (!marks || marks < 1 || marks > 3) return { node: DASH };
      const bars = marks as 1 | 2 | 3;
      return {
        node: (
          <span
            title={`${marks} mark${marks > 1 ? "s" : ""} of excellence`}
            className="flex justify-center"
          >
            <MoEIcon bars={bars} color={MOE_COLORS[bars]} />
          </span>
        ),
      };
    },
    sortValue: (r) => r.moe ?? -1,
  },
  {
    key: "battles",
    label: "Battles",
    tip: "Total games played on the tank",
    align: "end",
    defaultVisible: true,
    cell: (r) => ({ node: intFmt.format(r.battles) }),
    sortValue: (r) => r.battles,
  },
  {
    key: "avgDamage",
    label: "Avg damage",
    align: "end",
    defaultVisible: true,
    cell: (r) => ({ node: r.avgDamage != null ? intFmt.format(r.avgDamage) : DASH }),
    sortValue: (r) => r.avgDamage ?? -1,
  },
  {
    key: "avgXp",
    label: "Avg XP",
    align: "end",
    defaultVisible: true,
    hideOnMobile: true,
    cell: (r) => ({ node: r.avgXp != null ? intFmt.format(r.avgXp) : DASH }),
    sortValue: (r) => r.avgXp ?? -1,
  },
  {
    key: "winrate",
    label: "WR",
    tip: "Overall (lifetime) win rate",
    align: "end",
    defaultVisible: true,
    cell: (r) => ({
      node: r.winrate != null ? `${pct2Fmt.format(r.winrate * 100)}%` : DASH,
      className:
        r.winrate != null ? RATING_COLOR_CLASS[winrateColor(r.winrate)] : undefined,
    }),
    sortValue: (r) => r.winrate ?? -1,
  },
  {
    key: "rating",
    label: "Rating (WN)",
    align: "end",
    defaultVisible: true,
    header: (m) => metricLabel(m),
    cell: (r, { metric }) => {
      const v = ratingForMetric(r, metric);
      return {
        node: v != null ? dec2Fmt.format(v) : DASH,
        className: v != null ? ratingColorClass(v, metric) : undefined,
      };
    },
    sortValue: (r, m) => ratingForMetric(r, m) ?? -1,
  },
];

export const PLAYER_COLUMN_BY_KEY: Record<string, PlayerColumn> =
  Object.fromEntries(PLAYER_COLUMNS.map((c) => [c.key, c]));
const DEFAULT_KEYS = PLAYER_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.key,
);

// Cookie-backed set of visible column keys, shared between the selector (in the
// filter bar) and the table via useCookie's broadcast.
export function usePlayerColumns(): [Set<string>, (key: string) => void] {
  const [raw, setRaw] = useCookie(COLS_COOKIE, DEFAULT_KEYS.join(","));
  const selected = useMemo(() => {
    const set = new Set(raw.split(",").filter((k) => PLAYER_COLUMN_BY_KEY[k]));
    return set.size > 0 ? set : new Set(DEFAULT_KEYS);
  }, [raw]);
  const toggle = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setRaw(
        PLAYER_COLUMNS.filter((c) => next.has(c.key))
          .map((c) => c.key)
          .join(","),
      );
    },
    [selected, setRaw],
  );
  return [selected, toggle];
}

export function PlayerColumnSelector() {
  const [selected, onToggle] = usePlayerColumns();
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
          {selected.size}/{PLAYER_COLUMNS.length}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-96 w-56 overflow-y-auto rounded-lg border border-fd-border bg-fd-popover p-2 shadow-lg">
          {PLAYER_COLUMNS.map((c) => (
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
      )}
    </div>
  );
}
