"use client";

import type { NumberFormatter } from "@/lib/format";

import { useFormat } from "@/hooks/use-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GlossaryLabel } from "@/components/glossary/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useStatsPeriod } from "@/hooks/use-period";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { StrongholdPeriod, type Stats, type PeriodStats, type PeriodValues, type PlayerDerivedStats, RATING_COLOR_CLASS, type RatingColor, winrateColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
import { useTranslation } from "@/hooks/use-translation";

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

type Cell = { primary: string; secondary?: string; color?: RatingColor; className?: string };

const EMPTY_CELL: Cell = { primary: "—" };

type PeriodCellSet = { total: Cell; h24: Cell; d7: Cell; d30: Cell };

type RowInput = {
  current: Stats;
  periods: PeriodStats;
  derived: PlayerDerivedStats;
};

// One ordered row of the table. `cells` derives its four period cells from the
// data. Defined once, so the real table and its loading skeleton share the exact
// same rows (labels + order) — the skeleton can never drift from the real table.
type RowDef = {
  /** Key of the row's wording in `components/players/detail/overview/stats-table`. */
  id: string;
  /** The English name, which is also what the glossary is keyed by. Not what a
   * reader sees: `t(rows.<id>)` is. */
  label: string;
  /** The term to look up, when the row's wording is not the term's own: this
   * table's "Tier" is the average tier of the battles played, not a vehicle's. */
  term?: string;
  ratingRow?: "wn7" | "wn8" | "wnx";
  /** Takes the reader's number formatting rather than reading a hook: a row
   * definition is data at module scope. */
  cells: (input: RowInput, num: NumberFormatter) => PeriodCellSet;
};

function pctOrDash(num: NumberFormatter, n: number, d: number): string {
  return d <= 0 ? "—" : num(PERCENT_FORMAT).format(n / d);
}

function avgOrDash(num: NumberFormatter, n: number, d: number): string {
  return d <= 0 ? "—" : num(DECIMAL_FORMAT).format(n / d);
}

// Turns the server-computed numeric values into display cells, optionally
// color-coding them with the matching rating scale.
function cellsFrom(
  num: NumberFormatter,
  values: PeriodValues,
  color?: (v: number) => RatingColor,
): PeriodCellSet {
  const cell = (value: number | null): Cell => {
    if (value === null) return EMPTY_CELL;
    return {
      primary: num(DECIMAL_FORMAT).format(value),
      color: color ? color(value) : undefined,
    };
  };
  return {
    total: cell(values.total),
    h24: cell(values.h24),
    d7: cell(values.d7),
    d30: cell(values.d30),
  };
}

// A row whose cells come from the raw account `Stats` (Total from `current`, the
// period columns from the diffs). `renderDelta` formats the period cells when it
// differs from the total (signed values for ratings).
function statRow(
  id: string,
  label: string,
  render: (s: Stats, num: NumberFormatter) => Cell,
  renderDelta?: (s: Stats, num: NumberFormatter) => Cell,
): RowDef {
  return {
    id,
    label,
    cells: ({ current, periods }, num) => {
      const delta = renderDelta ?? render;
      return {
        total: render(current, num),
        h24: periods.h24 ? delta(periods.h24, num) : EMPTY_CELL,
        d7: periods.d7 ? delta(periods.d7, num) : EMPTY_CELL,
        d30: periods.d30 ? delta(periods.d30, num) : EMPTY_CELL,
      };
    },
  };
}

// A row whose per-period values are pre-computed server-side (tank-breakdown
// stats: tier, assistance damages, WN7/8/X).
function derivedRow(
  id: string,
  label: string,
  pick: (d: PlayerDerivedStats) => PeriodValues,
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
    cells: ({ derived }, num) => cellsFrom(num, pick(derived), options.color),
  };
}

// The single source of truth for the table's rows and their order (Tier after
// Battles, the four damage-breakdown rows after Damages, ratings last).
const ROWS: RowDef[] = [
  statRow("battles", "Battles", (s, num) => ({ primary: num(INTEGER_FORMAT).format(s.battles) })),
  derivedRow("tier", "Tier", (d) => d.tier, { term: "Average tier" }),
  statRow("wins", "Wins", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.wins),
    secondary: pctOrDash(num, s.wins, s.battles),
    color: s.battles > 0 ? winrateColor(s.wins / s.battles) : undefined,
  })),
  statRow("losses", "Losses", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.losses),
    secondary: pctOrDash(num, s.losses, s.battles),
  })),
  statRow("draws", "Draws", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.draws),
    secondary: pctOrDash(num, s.draws, s.battles),
  })),
  statRow("survived", "Battles survived", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.survivedBattles),
    secondary: pctOrDash(num, s.survivedBattles, s.battles),
  })),
  statRow("destroyed", "Tanks destroyed", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.frags),
    secondary: avgOrDash(num, s.frags, s.battles),
  })),
  statRow("destruction-ratio", "Destruction ratio", (s, num) => ({
    primary: avgOrDash(num, s.frags, s.battles - s.survivedBattles),
  })),
  statRow("spotted", "Tanks spotted", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.spotted),
    secondary: avgOrDash(num, s.spotted, s.battles),
  })),
  statRow("damages", "Damages", (s, num) => ({
    primary: avgOrDash(num, s.damageDealt, s.battles),
  })),
  derivedRow("track-damages", "Track damages", (d) => d.trackDamage),
  derivedRow("spotting-damages", "Spotting damages", (d) => d.spottingDamage),
  derivedRow("assisting-damages", "Assisting damages", (d) => d.assistingDamage),
  derivedRow("combined-damages", "Combined damages", (d) => d.combinedDamage),
  statRow("base-capture", "Base capture", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.capturePoints),
    secondary: avgOrDash(num, s.capturePoints, s.battles),
  })),
  statRow("base-defense", "Base defense", (s, num) => ({
    primary: num(INTEGER_FORMAT).format(s.droppedCapturePoints),
    secondary: avgOrDash(num, s.droppedCapturePoints, s.battles),
  })),
  statRow("experience", "Experience", (s, num) => ({
    primary: avgOrDash(num, s.xp, s.battles),
  })),
  statRow("hit-rate", "Hit rate", (s, num) => ({
    primary: pctOrDash(num, s.hits, s.shots),
  })),
  statRow(
    "personal-rating",
    "Personal rating",
    (s, num) => ({ primary: num(INTEGER_FORMAT).format(s.globalRating) }),
    (s, num) => ({
      primary: num(SIGNED_INTEGER_FORMAT).format(s.globalRating),
      className:
        s.globalRating > 0
          ? "text-emerald-500"
          : s.globalRating < 0
            ? "text-red-500"
            : undefined,
    }),
  ),
  statRow(
    "wtr",
    "World of Tanks Rating",
    (s, num) => ({ primary: s.wtr === null ? "—" : num(INTEGER_FORMAT).format(s.wtr) }),
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
  ),
  derivedRow("wn7", "WN7", (d) => d.wn7, { color: wn7Color, ratingRow: "wn7" }),
  derivedRow("wn8", "WN8", (d) => d.wn8, { color: wn8Color, ratingRow: "wn8" }),
  derivedRow("wnx", "WNX", (d) => d.wnx, { color: wnxColor, ratingRow: "wnx" }),
];

function PeriodCells({
  cell,
  hideOnMobile,
}: {
  cell: Cell;
  hideOnMobile?: boolean;
}) {
  const hide = hideOnMobile ? styles.hiddenFixedColumn : "";
  if (!cell.secondary) {
    return (
      <TableCell
        className={cn(
          "py-1.5! text-right tabular-nums",
          hide,
          cell.color && RATING_COLOR_CLASS[cell.color],
          cell.className,
        )}
        colSpan={2}
      >
        <span className={cell.primary === "—" ? "text-muted-foreground" : ""}>
          {cell.primary}
        </span>
      </TableCell>
    );
  }
  return (
    <>
      <TableCell className={cn("py-1.5! pe-1! text-right tabular-nums", hide)}>
        <span className={cell.primary === "—" ? "text-muted-foreground" : ""}>
          {cell.primary}
        </span>
      </TableCell>
      <TableCell
        className={cn(
          "py-1.5! ps-1! text-right tabular-nums",
          hide,
          cell.color && RATING_COLOR_CLASS[cell.color],
        )}
      >
        {cell.secondary}
      </TableCell>
    </>
  );
}

/** A period-cell placeholder spanning the two sub-columns, right-aligned like the
 * real numbers. Shown when `loading`. */
function PeriodSkeleton({ hideOnMobile }: { hideOnMobile?: boolean }) {
  return (
    <TableCell
      colSpan={2}
      className={cn("py-1.5! text-right", hideOnMobile && styles.hiddenFixedColumn)}
    >
      <Skeleton className="ml-auto h-4 w-12" />
    </TableCell>
  );
}

/**
 * The random-battles stats table. Rows arrive pre-computed from the server (see
 * services/players/derived-stats); this only formats them. Pass `{ loading }` to
 * render the same table shell + row labels with placeholder cells — one row list,
 * so the skeleton can't drift from the real table.
 */
export function PlayerStatsTable(
  props:
    | { loading: true }
    | { current: Stats; periods: PeriodStats; derived: PlayerDerivedStats },
) {
  const { num } = useFormat();
  const { t } = useTranslation(
    "components/players/detail/overview/stats-table",
  );
  const loading = "loading" in props;
  // Which of the four windows a phone shows. Read once here and passed down
  // rather than read per cell: the table is 23 rows of four periods, and each
  // read is a cookie subscription.
  const [period] = useStatsPeriod();
  const off = (p: StrongholdPeriod) => p !== period;
  // Below `sm` the chosen window's two sub-columns take 22% each and the
  // other three windows take none; from `sm` up all four are drawn.
  const colClass = (p: StrongholdPeriod) =>
    cn(off(p) ? "max-sm:w-0!" : "max-sm:w-[22%]", "sm:w-[9%]");

  return (
    <Table className="my-0! table-fixed [&_td]:min-w-0 [&_tr>*+*]:border-l [&_tr>*:first-child]:pl-4! [&_tr>*]:border-border [&_th]:py-1! [&_td]:py-0.5!">
      {/* One window at a time below `sm`, so its two sub-columns take 44% and
          the stat names keep the rest. The other three collapse to nothing
          rather than being removed, see `styles.hiddenFixedColumn`. */}
      <colgroup>
        <col />
        <col className={colClass(StrongholdPeriod.Overall)} />
        <col className={colClass(StrongholdPeriod.Overall)} />
        <col className={colClass(StrongholdPeriod.Day)} />
        <col className={colClass(StrongholdPeriod.Day)} />
        <col className={colClass(StrongholdPeriod.Week)} />
        <col className={colClass(StrongholdPeriod.Week)} />
        <col className={colClass(StrongholdPeriod.Month)} />
        <col className={colClass(StrongholdPeriod.Month)} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>{t("stat")}</TableHead>
          <TableHead
            className={cn(
              "text-right",
              off(StrongholdPeriod.Overall) && styles.hiddenFixedColumn,
            )}
            colSpan={2}
          >
            {t("periods.total")}
          </TableHead>
          <TableHead
            className={cn(
              "text-right",
              off(StrongholdPeriod.Day) && styles.hiddenFixedColumn,
            )}
            colSpan={2}
          >
            {t("periods.day")}
          </TableHead>
          <TableHead
            className={cn(
              "text-right",
              off(StrongholdPeriod.Week) && styles.hiddenFixedColumn,
            )}
            colSpan={2}
          >
            {t("periods.week")}
          </TableHead>
          <TableHead
            className={cn(
              "text-right",
              off(StrongholdPeriod.Month) && styles.hiddenFixedColumn,
            )}
            colSpan={2}
          >
            {t("periods.month")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => {
          const cells = loading ? null : row.cells(props, num);
          return (
            <TableRow
              key={row.id}
              data-rating-row={row.ratingRow}
            >
              <TableCell className="py-1.5! font-medium">
                <GlossaryLabel label={row.term ?? row.label}>
                  {t(`rows.${row.id}`)}
                </GlossaryLabel>
              </TableCell>
              {cells ? (
                <>
                  <PeriodCells
                    cell={cells.total}
                    hideOnMobile={off(StrongholdPeriod.Overall)}
                  />
                  <PeriodCells
                    cell={cells.h24}
                    hideOnMobile={off(StrongholdPeriod.Day)}
                  />
                  <PeriodCells
                    cell={cells.d7}
                    hideOnMobile={off(StrongholdPeriod.Week)}
                  />
                  <PeriodCells
                    cell={cells.d30}
                    hideOnMobile={off(StrongholdPeriod.Month)}
                  />
                </>
              ) : (
                <>
                  <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Overall)} />
                  <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Day)} />
                  <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Week)} />
                  <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Month)} />
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
