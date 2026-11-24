import type { NumberFormatter } from "@/lib/format";
import {
  type PeriodDerivedValues,
  type PlayerPeriodStats,
  RatingMetric,
  type RatingColor,
  prColor,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
  wtrColor,
} from "@unicum.gg/shared";

const INTEGER_FORMAT = { maximumFractionDigits: 0 } as const;
const SIGNED_INTEGER_FORMAT = {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
} as const;
const DECIMAL_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PERCENT_FORMAT = {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

export type Cell = { primary: string; secondary?: string; color?: RatingColor; className?: string };

export const EMPTY_CELL: Cell = { primary: "—" };

/**
 * One column of the table: the lifetime one, or a window. `stats` is null
 * when the window has no baseline yet, `derived` when its figures are not
 * known (both read as dashes).
 */
export type StatColumn = {
  stats: PlayerPeriodStats | null;
  derived: PeriodDerivedValues | null;
  /** The career column, where a rating reads as a rating rather than as the
   * change in one. */
  lifetime: boolean;
};

// One ordered row of the table. `cell` derives one column's cell from the
// data. Defined once, so the real table and its loading skeleton share the
// exact same rows (labels + order) — the skeleton can never drift from the
// real table.
export type RowDef = {
  /** Key of the row's wording in `components/players/detail/overview/stats-table`. */
  id: string;
  /** The English name, which is also what the glossary is keyed by. Not what a
   * reader sees: `t(rows.<id>)` is. */
  label: string;
  /** The term to look up, when the row's wording is not the term's own: this
   * table's "Tier" is the average tier of the battles played, not a vehicle's. */
  term?: string;
  /** The metric this row is the value of, so the one the reader picked is
   * set in bold (`html[data-rating-metric]` in `globals.css`). */
  ratingRow?: RatingMetric;
  /** Takes the reader's number formatting rather than reading a hook: a row
   * definition is data at module scope. */
  cell: (column: StatColumn, num: NumberFormatter) => Cell;
};

function pctOrDash(num: NumberFormatter, n: number, d: number): string {
  return d <= 0 ? "—" : num(PERCENT_FORMAT).format(n / d);
}

function avgOrDash(num: NumberFormatter, n: number, d: number): string {
  return d <= 0 ? "—" : num(DECIMAL_FORMAT).format(n / d);
}

// A count with its share or per-battle average beside it, or the empty cell
// when the window cannot answer it.
function countCell(
  num: NumberFormatter,
  n: number | null,
  battles: number,
  ratio: (num: NumberFormatter, n: number, d: number) => string,
): Cell {
  if (n === null) return EMPTY_CELL;
  return { primary: num(INTEGER_FORMAT).format(n), secondary: ratio(num, n, battles) };
}

// Turns a server-computed numeric value into a display cell, optionally
// color-coding it with the matching rating scale.
function derivedCell(
  num: NumberFormatter,
  value: number | null,
  color?: (v: number) => RatingColor,
): Cell {
  if (value === null) return EMPTY_CELL;
  return {
    primary: num(DECIMAL_FORMAT).format(value),
    color: color ? color(value) : undefined,
  };
}

// A row whose cells come from the counters (Total from the account's `current`,
// the period columns from the vehicle diffs). A period counter can be null (see
// `PlayerPeriodStats`), hence the wider type, which `Stats` satisfies.
// `renderDelta` formats the period cells when it differs from the total
// (signed values for ratings).
function statRow(
  id: string,
  label: string,
  render: (s: PlayerPeriodStats, num: NumberFormatter) => Cell,
  renderDelta?: (s: PlayerPeriodStats, num: NumberFormatter) => Cell,
  options: { ratingRow?: RatingMetric } = {},
): RowDef {
  return {
    id,
    label,
    ratingRow: options.ratingRow,
    cell: ({ stats, lifetime }, num) => {
      if (!stats) return EMPTY_CELL;
      return (lifetime ? render : (renderDelta ?? render))(stats, num);
    },
  };
}

// A row whose per-period values are pre-computed server-side (tank-breakdown
// stats: tier, assistance damages, WN7/8/X).
function derivedRow(
  id: string,
  label: string,
  key: keyof PeriodDerivedValues,
  options: {
    color?: (v: number) => RatingColor;
    ratingRow?: RowDef["ratingRow"];
    term?: string;
  } = {},
): RowDef {
  return {
    id,
    label,
    term: options.term,
    ratingRow: options.ratingRow,
    cell: ({ derived }, num) =>
      derived ? derivedCell(num, derived[key], options.color) : EMPTY_CELL,
  };
}

// The single source of truth for the table's rows and their order (Tier after
// Battles, the four damage-breakdown rows after Damages, ratings last).
export const ROWS: RowDef[] = [
  statRow("battles", "Battles", (s, num) => ({ primary: num(INTEGER_FORMAT).format(s.battles) })),
  derivedRow("tier", "Tier", "tier", { term: "Average tier" }),
  statRow("wins", "Wins", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.wins),
    secondary: pctOrDash(num, s.wins, s.battles),
    color: s.battles > 0 ? winrateColor(s.wins / s.battles) : undefined,
  })),
  statRow("losses", "Losses", (s, num) => countCell(num, s.losses, s.battles, pctOrDash)),
  statRow("draws", "Draws", (s, num) => countCell(num, s.draws, s.battles, pctOrDash)),
  statRow("survived", "Battles survived", (s, num) =>
    countCell(num, s.survivedBattles, s.battles, pctOrDash),
  ),
  statRow("destroyed", "Tanks destroyed", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.frags),
    secondary: avgOrDash(num, s.frags, s.battles),
  })),
  statRow("destruction-ratio", "Destruction ratio", (s, num) =>
    s.survivedBattles === null
      ? EMPTY_CELL
      : { primary: avgOrDash(num, s.frags, s.battles - s.survivedBattles) },
  ),
  statRow("spotted", "Tanks spotted", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.spotted),
    secondary: avgOrDash(num, s.spotted, s.battles),
  })),
  statRow("damages", "Damages", (s, num) => ({
    primary: avgOrDash(num, s.damageDealt, s.battles),
  })),
  derivedRow("track-damages", "Track damages", "trackDamage"),
  derivedRow("spotting-damages", "Spotting damages", "spottingDamage"),
  derivedRow("assisting-damages", "Assisting damages", "assistingDamage"),
  derivedRow("combined-damages", "Combined damages", "combinedDamage"),
  statRow("base-capture", "Base capture", (s, num) =>
    countCell(num, s.capturePoints, s.battles, avgOrDash),
  ),
  statRow("base-defense", "Base defense", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.droppedCapturePoints),
    secondary: avgOrDash(num, s.droppedCapturePoints, s.battles),
  })),
  statRow("experience", "Experience", (s, num) => ({
    primary: avgOrDash(num, s.xp, s.battles),
  })),
  statRow("hit-rate", "Hit rate", (s, num) =>
    s.hits === null || s.shots === null
      ? EMPTY_CELL
      : { primary: pctOrDash(num, s.hits, s.shots) },
  ),
  statRow(
    "personal-rating",
    "Personal rating",
    // Only the lifetime figure is coloured: the period columns are the change
    // in a career figure, not a rating of those battles (see `RatingMetric`).
    (s, num) =>
      s.globalRating === null
        ? EMPTY_CELL
        : {
            primary: num(INTEGER_FORMAT).format(s.globalRating),
            color: prColor(s.globalRating),
          },
    (s, num) =>
      s.globalRating === null
        ? EMPTY_CELL
        : {
            primary: num(SIGNED_INTEGER_FORMAT).format(s.globalRating),
            className:
              s.globalRating > 0
                ? "text-emerald-500"
                : s.globalRating < 0
                  ? "text-red-500"
                  : undefined,
          },
    { ratingRow: RatingMetric.Pr },
  ),
  statRow(
    "wtr",
    "World of Tanks Rating",
    (s, num) =>
      s.wtr === null
        ? EMPTY_CELL
        : { primary: num(INTEGER_FORMAT).format(s.wtr), color: wtrColor(s.wtr) },
    (s, num) => ({
      primary: s.wtr === null ? "—" : num(SIGNED_INTEGER_FORMAT).format(s.wtr),
      className:
        s.wtr === null
          ? undefined
          : s.wtr > 0
            ? "text-emerald-500"
            : s.wtr < 0
              ? "text-red-500"
              : undefined,
    }),
    { ratingRow: RatingMetric.Wtr },
  ),
  derivedRow("wn7", "WN7", "wn7", { color: wn7Color, ratingRow: RatingMetric.Wn7 }),
  derivedRow("wn8", "WN8", "wn8", { color: wn8Color, ratingRow: RatingMetric.Wn8 }),
  derivedRow("wnx", "WNX", "wnx", { color: wnxColor, ratingRow: RatingMetric.Wnx }),
];
