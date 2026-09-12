import { numberFormat } from "@/lib/format";
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

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DEC2_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PCT1_FORMAT = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const;

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
  /** `locale` rides along like `metric`: a column definition is data at module
   * scope, so the reader's number formatting arrives from its renderer. */
  cell: (
    s: SessionStats,
    metric: RatingMetric,
    locale: string,
  ) => SessionCell;
  /**
   * Left out below `sm`.
   *
   * All fourteen columns came to 1,359px against a phone's 390, so the whole
   * table was read three and a half screens at a time and the date a row is
   * about was gone by the third one. What stays is what a session is judged on
   * (how much was played, how it went, how much damage): the rest is detail
   * that keeps its place on any screen wide enough to show it.
   */
  hideOnMobile?: boolean;
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

const num = (
  v: number | null,
  options: Intl.NumberFormatOptions,
  locale: string,
): SessionCell => ({
  node: v == null ? DASH : numberFormat(locale, options).format(v),
});

export const SESSION_COLUMNS: SessionColumn[] = [
  {
    key: "rating",
    label: "Rating (WN)",
    header: (m) => metricLabel(m),
    tip: "Rating of these battles alone, not of the account",
    cell: (s, metric, locale) => {
      const v = ratingOf(s, metric);
      return {
        node: v == null ? DASH : numberFormat(locale, INT_FORMAT).format(v),
        className: v == null ? undefined : ratingColorClass(v, metric),
      };
    },
  },
  {
    key: "winrate",
    label: "WR",
    tip: "Win rate over these battles",
    cell: (s, _metric, locale) => ({
      node: `${numberFormat(locale, PCT1_FORMAT).format(s.winrate * 100)}%`,
      className: RATING_COLOR_CLASS[winrateColor(s.winrate)],
    }),
  },
  {
    key: "avgDamage",
    label: "Avg damage",
    cell: (s, _metric, locale) => num(s.avgDamage, INT_FORMAT, locale),
  },
  {
    key: "avgFrags",
    label: "Avg frags",
    hideOnMobile: true,
    tip: "Enemies destroyed per battle",
    cell: (s, _metric, locale) => num(s.avgFrags, DEC2_FORMAT, locale),
  },
  {
    key: "damageRatio",
    label: "Damage ratio",
    hideOnMobile: true,
    tip: "Damage caused over damage received",
    cell: (s, _metric, locale) => num(s.damageRatio, DEC2_FORMAT, locale),
    has: (s) => s.damageRatio != null,
  },
  {
    key: "kd",
    label: "Destruction ratio",
    hideOnMobile: true,
    tip: "Enemies destroyed over vehicles lost",
    cell: (s, _metric, locale) => num(s.kd, DEC2_FORMAT, locale),
    has: (s) => s.kd != null,
  },
  {
    key: "survivalRate",
    label: "Battles survived",
    hideOnMobile: true,
    cell: (s, _metric, locale) => ({
      node:
        s.survivalRate == null ? DASH : `${numberFormat(locale, PCT1_FORMAT).format(s.survivalRate * 100)}%`,
    }),
    has: (s) => s.survivalRate != null,
  },
  {
    key: "avgSpotted",
    label: "Avg spotted",
    hideOnMobile: true,
    tip: "Enemies spotted per battle",
    cell: (s, _metric, locale) => num(s.avgSpotted, DEC2_FORMAT, locale),
  },
  {
    key: "avgDefense",
    label: "Base defense",
    hideOnMobile: true,
    tip: "Defence points per battle",
    cell: (s, _metric, locale) => num(s.avgDefense, DEC2_FORMAT, locale),
  },
  {
    key: "avgXp",
    label: "Avg XP",
    hideOnMobile: true,
    cell: (s, _metric, locale) => num(s.avgXp, INT_FORMAT, locale),
    has: (s) => s.avgXp != null,
  },
];

/** The columns worth drawing for these sessions, in order. */
export function visibleSessionColumns(
  sessions: SessionStats[],
): SessionColumn[] {
  return SESSION_COLUMNS.filter((c) => !c.has || sessions.some(c.has));
}

export { INT_FORMAT as sessionIntFmt };
