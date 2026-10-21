"use client";

import type { NumberFormatter } from "@/lib/format";

import { statLabel } from "@/components/stat-label";

import { useTranslation } from "@/hooks/use-translation";
import { useStatLabels } from "@/hooks/use-stat-labels";
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
import {
  MARK_TARGET_LABEL,
  MarkTarget,
  markBarRatio,
  markFor,
} from "./mark-target";
import { MoMIcon } from "@/components/tanks/mom-icon";
import { Hint } from "@/components/hint";
import { metricLabel } from "@/components/tanks/perf-columns";
import { useCookie } from "@/hooks/use-cookie";
import { markBar, MarkWindow, RatingMetric, RATING_COLOR_CLASS, winrateColor, wn7Color, wn8Color, wnxColor, type PlayerTankRow } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const COLS_COOKIE = "unicum.player_vehicle_columns";

/** The WN column's key, named here because two other things hide it: the table
 * drops it outside Random Battles, and so does the picker below. */
export const RATING_COLUMN_KEY = "rating";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DEC2_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PCT2_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
// One decimal rather than two: the column is read down rather than across, and
// a tenth of a percent is already finer than the estimate behind it. Rounding
// to a whole percent would print the same figure on rows the sort separates.
const PCT1_FORMAT = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const;
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

/** What a column needs to answer for a row beyond the row itself: the reader's
 * two choices, which no column definition can read on its own (they are module
 * constants, so they have no hook). Split from `PlayerCellCtx` because sorting
 * needs these and none of the rendering machinery. */
export type PlayerSortCtx = {
  metric: RatingMetric;
  markTarget: MarkTarget;
};

/** What a cell needs beyond its own row. `num` rides here rather than being a
 * third parameter: the context already exists for exactly this, and a column
 * definition is data at module scope that cannot read a hook. */
export type PlayerCellCtx = PlayerSortCtx & {
  region: Region;
  num: NumberFormatter;
  /** This file's own namespace, handed in like `num`: a column is a module
   * constant, so it has no hook of its own to read a string with. */
  t: ReturnType<typeof useTranslation>["t"];
};
export type PlayerCell = { node: ReactNode; className?: string };
export type PlayerColumn = {
  key: string;
  label: string;
  tip?: string;
  align: "center" | "end";
  defaultVisible: boolean;
  hideOnMobile?: boolean;
  // The rating and mark columns' headers follow the reader's own choices.
  header?: (ctx: PlayerSortCtx) => string;
  cell: (r: PlayerTankRow, ctx: PlayerCellCtx) => PlayerCell;
  sortValue: (r: PlayerTankRow, ctx: PlayerSortCtx) => number;
  /**
   * What the min/max filter ranges over, in the unit the cell SHOWS (a win rate
   * is a percentage here and a fraction on the row), or null on a row the
   * column cannot answer for.
   *
   * Declared here rather than listed again beside the table, which is how the
   * filter came to be missing half the columns: the list was written once and
   * every column added afterwards was invisible to it. A column without one is
   * deliberately not rangeable (the mastery badge and the mark count are small
   * value sets, and the chip rows filter those exactly).
   *
   * Null rather than `sortValue`'s -1: that sentinel exists to sort an unknown
   * below everything, and ranged over it would make `min: -5` keep every
   * vehicle the column knows nothing about.
   */
  rangeValue?: (r: PlayerTankRow, ctx: PlayerSortCtx) => number | null;
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
    tip: "Marks of Excellence on the gun, and how far the next one is",
    align: "center",
    defaultVisible: true,
    hideOnMobile: true,
    cell: (r, ctx) => {
      const marks = r.moe;
      const percent = r.moePercent;
      const bars = marks && marks >= 1 && marks <= 3 ? (marks as 1 | 2 | 3) : null;
      // A gun with no mark yet still has progress worth showing, and a gun
      // with three still has a figure that moves. So the two are drawn
      // independently and the cell is empty only when there is neither.
      if (!bars && percent == null) return { node: DASH };
      return {
        node: (
          <Hint
            content={
              bars ? ctx.t("n-marks-of-excellence", { count: bars }) : null
            }
          >
            <span className="flex items-center justify-center gap-1.5">
              {/*
              Both halves are a fixed width, which is the whole trick. The icon
              draws its three places whatever was earned, and the figure is
              held to the width of its longest form, "100.00%". Either one left
              to size itself puts the column out of true: one mark is a third
              the width of three, and a hundred is a digit wider than ninety.
              */}
              <MoEIcon bars={bars ?? 0} color={bars ? MOE_COLORS[bars] : ""} empty />
              {percent == null ? null : (
                <span className="text-fd-muted-foreground w-[7ch] text-right tabular-nums">
                  {percent.toFixed(2)}%
                </span>
              )}
            </span>
          </Hint>
        ),
      };
    },
    // The percent sorts the column when we have it, because it separates two
    // guns that both show three bars; the count is the fallback, scaled so a
    // tank with marks and no percent still sorts above one with neither.
    sortValue: (r) => r.moePercent ?? (r.moe != null ? r.moe * 25 : -1),
  },
  {
    key: "markReach",
    // The heading names the bar the column is dividing by, which the reader
    // picks beside the column selector. The default is the one the garage
    // reads naturally: every gun against the mark it would earn next.
    label: MARK_TARGET_LABEL[MarkTarget.Next],
    tip: "How much of that mark's combined-damage bar this account's own average on the vehicle covers. 100% is the bar itself",
    align: "end",
    defaultVisible: true,
    hideOnMobile: true,
    header: ({ markTarget }) => MARK_TARGET_LABEL[markTarget],
    cell: (r, ctx) => {
      const reach = r.markReach;
      const mark = markFor(ctx.markTarget, r.moe);
      const ratio = markBarRatio(reach, ctx.markTarget, r.moe);
      // No bars for the vehicle, too few battles on it, a tier the game puts no
      // marks on, or a gun with three marks under the "next mark" heading,
      // which has no next mark. Said as an absence rather than as a zero, which
      // would sort below vehicles that are merely far off.
      if (!reach || ratio == null || mark == null) return { node: DASH };
      const cleared = ratio >= 1;
      return {
        node: (
          // The bar is named, not just given. Under `Next` the column heading
          // cannot say which mark a row was measured against, and for a vehicle
          // whose marks we have never read (the whole garage, on an account no
          // page view has ever sent through the portal) the next mark is taken
          // as the first, which is a guess the figure must not hide.
          <Hint
            content={ctx.t(
              reach.window === MarkWindow.Recent
                ? "mark-bar-title-recent"
                : "mark-bar-title",
              {
                combined: ctx.num(INT_FORMAT).format(reach.combined),
                bar: ctx.num(INT_FORMAT).format(markBar(reach, mark)),
                battles: ctx.num(INT_FORMAT).format(reach.battles),
                marks: mark,
              },
            )}
          >
            <span
              className="tabular-nums"
              // Coloured only once the average is past the bar, in the mark's
              // own colour: that is the one state worth spotting down a column
              // of three hundred rows, and it is the same grammar the marks
              // panel uses for the vehicles already over a bar.
              style={cleared ? { color: MOE_COLORS[mark] } : undefined}
            >
              {ctx.num(PCT1_FORMAT).format(ratio * 100)}%
            </span>
          </Hint>
        ),
      };
    },
    sortValue: (r, ctx) =>
      markBarRatio(r.markReach, ctx.markTarget, r.moe) ?? -1,
    rangeValue: (r, ctx) => {
      const ratio = markBarRatio(r.markReach, ctx.markTarget, r.moe);
      return ratio == null ? null : ratio * 100;
    },
  },
  {
    key: "battles",
    label: "Battles",
    tip: "Total games played on the tank",
    align: "end",
    defaultVisible: true,
    cell: (r, { num }) => ({ node: num(INT_FORMAT).format(r.battles) }),
    sortValue: (r) => r.battles,
    rangeValue: (r) => r.battles,
  },
  {
    key: "avgDamage",
    label: "Avg damage",
    align: "end",
    defaultVisible: true,
    cell: (r, { num }) => ({ node: r.avgDamage != null ? num(INT_FORMAT).format(r.avgDamage) : DASH }),
    sortValue: (r) => r.avgDamage ?? -1,
    rangeValue: (r) => r.avgDamage,
  },
  {
    key: "avgXp",
    label: "Avg XP",
    align: "end",
    defaultVisible: true,
    hideOnMobile: true,
    cell: (r, { num }) => ({ node: r.avgXp != null ? num(INT_FORMAT).format(r.avgXp) : DASH }),
    sortValue: (r) => r.avgXp ?? -1,
    rangeValue: (r) => r.avgXp,
  },
  {
    key: "winrate",
    label: "WR",
    tip: "Overall (lifetime) win rate",
    align: "end",
    defaultVisible: true,
    cell: (r, { num }) => ({
      node: r.winrate != null ? `${num(PCT2_FORMAT).format(r.winrate * 100)}%` : DASH,
      className:
        r.winrate != null ? RATING_COLOR_CLASS[winrateColor(r.winrate)] : undefined,
    }),
    sortValue: (r) => r.winrate ?? -1,
    // Percentage points, like the cell: a reader typing 55 means 55%.
    rangeValue: (r) => (r.winrate != null ? r.winrate * 100 : null),
  },
  {
    key: RATING_COLUMN_KEY,
    label: "Rating (WN)",
    align: "end",
    defaultVisible: true,
    header: ({ metric }) => metricLabel(metric),
    cell: (r, { metric, num }) => {
      const v = ratingForMetric(r, metric);
      return {
        node: v != null ? num(DEC2_FORMAT).format(v) : DASH,
        className: v != null ? ratingColorClass(v, metric) : undefined,
      };
    },
    sortValue: (r, { metric }) => ratingForMetric(r, metric) ?? -1,
    rangeValue: (r, { metric }) => ratingForMetric(r, metric),
  },
];

/** The columns the min/max filter can range over, in table order. */
export const PLAYER_RANGE_COLUMNS = PLAYER_COLUMNS.filter(
  (
    c,
  ): c is PlayerColumn & {
    rangeValue: NonNullable<PlayerColumn["rangeValue"]>;
  } => c.rangeValue != null,
);

export const PLAYER_COLUMN_BY_KEY: Record<string, PlayerColumn> =
  Object.fromEntries(PLAYER_COLUMNS.map((c) => [c.key, c]));
const DEFAULT_KEYS = PLAYER_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.key,
);

/**
 * What the table keeps when a vehicle record is open beside it.
 *
 * The list loses about a third of its width to the record, and thirteen columns
 * in what is left wraps every second tank name onto three lines. So it falls
 * back to the game's own list: what the tank is, how much it was played, and
 * how well. Nothing is lost, because the columns dropped here (mastery, marks,
 * average XP) are all spelled out in the record itself.
 *
 * A display-time filter, never a write: the reader's chosen columns are in a
 * cookie and come back untouched the moment the record is closed.
 */
export const COMPACT_COLUMN_KEYS = new Set([
  "battles",
  "avgDamage",
  "winrate",
  "rating",
]);

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

export function PlayerColumnSelector({
  /** Outside Random Battles the WN column holds nothing and the table drops it,
   * so offering it here would be a switch that does nothing. See
   * `TANK_MODES_RATED`. */
  rated = true,
}: {
  rated?: boolean;
} = {}) {
  const { t: tStats } = useStatLabels();
  const { t } = useTranslation(
    "components/players/detail/tanks/vehicle-columns",
  );
  const [selected, onToggle] = usePlayerColumns();
  const offered = useMemo(
    () => PLAYER_COLUMNS.filter((c) => rated || c.key !== RATING_COLUMN_KEY),
    [rated],
  );
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
        {t("columns")}
        <span className="text-fd-muted-foreground">
          {offered.filter((c) => selected.has(c.key)).length}/{offered.length}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-96 w-56 overflow-y-auto rounded-lg border border-fd-border bg-fd-popover p-2 shadow-lg">
          {offered.map((c) => (
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
              <span>{statLabel(c.label, tStats)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
