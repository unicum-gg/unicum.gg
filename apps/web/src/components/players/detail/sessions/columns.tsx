import type { ReactNode } from "react";
import { metricLabel } from "@/components/tanks/perf-columns";
import {
  RATING_COLOR_CLASS,
  RatingMetric,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
  type SessionStats,
} from "@unicum.gg/shared";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dec2Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct1Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const DASH: ReactNode = (
  <span className="text-fd-muted-foreground">&mdash;</span>
);

export type SessionCell = { node: ReactNode; className?: string };

/**
 * One column of the sessions table.
 *
 * Typed on `SessionStats` rather than on a session, because a row and the
 * vehicles inside it carry exactly the same numbers: the breakdown reuses these
 * definitions instead of restating them, so a column can never mean one thing
 * on the row and another on the tank that made it.
 */
export type SessionColumn = {
  key: string;
  label: string;
  tip?: string;
  /** The rating column follows the reader's metric, so its header moves. */
  header?: (metric: RatingMetric) => string;
  cell: (s: SessionStats, metric: RatingMetric) => SessionCell;
  /** Whether the column has anything to say about this set of sessions. A
   * counter added to the snapshots after the fact only exists from that day on,
   * so the whole column would otherwise be dashes for a history recorded before
   * it: better to leave it out than to show a column that only ever says "no". */
  has?: (s: SessionStats) => boolean;
};

function ratingOf(s: SessionStats, metric: RatingMetric): number | null {
  if (metric === RatingMetric.Wn7) return s.wn7;
  if (metric === RatingMetric.Wn8) return s.wn8;
  return s.wnx;
}

function ratingColorClass(value: number, metric: RatingMetric): string {
  if (metric === RatingMetric.Wn7) return RATING_COLOR_CLASS[wn7Color(value)];
  if (metric === RatingMetric.Wn8) return RATING_COLOR_CLASS[wn8Color(value)];
  return RATING_COLOR_CLASS[wnxColor(value)];
}

const num = (v: number | null, fmt: Intl.NumberFormat): SessionCell => ({
  node: v == null ? DASH : fmt.format(v),
});

export const SESSION_COLUMNS: SessionColumn[] = [
  {
    key: "rating",
    label: "Rating (WN)",
    header: (m) => metricLabel(m),
    tip: "Rating of these battles alone, not of the account",
    cell: (s, metric) => {
      const v = ratingOf(s, metric);
      return {
        node: v == null ? DASH : intFmt.format(v),
        className: v == null ? undefined : ratingColorClass(v, metric),
      };
    },
  },
  {
    key: "winrate",
    label: "WR",
    tip: "Win rate over these battles",
    cell: (s) => ({
      node: `${pct1Fmt.format(s.winrate * 100)}%`,
      className: RATING_COLOR_CLASS[winrateColor(s.winrate)],
    }),
  },
  {
    key: "avgDamage",
    label: "Avg damage",
    cell: (s) => num(s.avgDamage, intFmt),
  },
  {
    key: "avgFrags",
    label: "Avg frags",
    tip: "Enemies destroyed per battle",
    cell: (s) => num(s.avgFrags, dec2Fmt),
  },
  {
    key: "damageRatio",
    label: "Damage ratio",
    tip: "Damage caused over damage received",
    cell: (s) => num(s.damageRatio, dec2Fmt),
    has: (s) => s.damageRatio != null,
  },
  {
    key: "kd",
    label: "Destruction ratio",
    tip: "Enemies destroyed over vehicles lost",
    cell: (s) => num(s.kd, dec2Fmt),
    has: (s) => s.kd != null,
  },
  {
    key: "survivalRate",
    label: "Battles survived",
    cell: (s) => ({
      node:
        s.survivalRate == null ? DASH : `${pct1Fmt.format(s.survivalRate * 100)}%`,
    }),
    has: (s) => s.survivalRate != null,
  },
  {
    key: "avgSpotted",
    label: "Avg spotted",
    tip: "Enemies spotted per battle",
    cell: (s) => num(s.avgSpotted, dec2Fmt),
  },
  {
    key: "avgDefense",
    label: "Base defense",
    tip: "Defence points per battle",
    cell: (s) => num(s.avgDefense, dec2Fmt),
  },
  {
    key: "avgXp",
    label: "Avg XP",
    cell: (s) => num(s.avgXp, intFmt),
    has: (s) => s.avgXp != null,
  },
];

/** The columns worth drawing for these sessions, in order. */
export function visibleSessionColumns(
  sessions: SessionStats[],
): SessionColumn[] {
  return SESSION_COLUMNS.filter((c) => !c.has || sessions.some(c.has));
}

export { intFmt as sessionIntFmt };
