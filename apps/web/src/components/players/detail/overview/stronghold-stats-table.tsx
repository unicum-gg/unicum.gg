"use client";

import type { NumberFormatter } from "@/lib/format";

import { useFormat } from "@/hooks/use-format";
import { statLabel } from "@/components/stat-label";
import { useTranslation } from "@/hooks/use-translation";
import { useStatLabels } from "@/hooks/use-stat-labels";
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
import { StrongholdPeriod, computeMR, computeMRB, mrbColor, mrColor, RatedMode, winrateColor, RATING_COLOR_CLASS, type MRInputs, type RatingColor, type StrongholdStats } from "@unicum.gg/shared";

// The Wins row colors its win rate with the mode's own scale. Defaults to the
// random-battle 50%-anchored one; a rated mode passes its own median-anchored scale
// (top-5 placement, ~41% median) via the table's `winrateColorFn` prop.
export type WinrateColorFn = (wr: number) => RatingColor;

const INTEGER_FORMAT = { maximumFractionDigits: 0 } as const;
const DECIMAL_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PERCENT_FORMAT = {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

type Cell = { primary: string; secondary?: string; color?: RatingColor };

const EMPTY_CELL: Cell = { primary: "—" };

function pctOrDash(num: NumberFormatter, n: number, d: number): string {
  return d <= 0 ? "—" : num(PERCENT_FORMAT).format(n / d);
}

function avgOrDash(num: NumberFormatter, n: number, d: number): string {
  return d <= 0 ? "—" : num(DECIMAL_FORMAT).format(n / d);
}

export type RowDef = {
  label: string;
  /** Takes the reader's number formatting: a row definition is data at module
   * scope and cannot read a hook. */
  render: (s: StrongholdStats, num: NumberFormatter) => Cell;
};

// A rating row, appended to a mode's shared row set (see StrongholdTab). The
// compute returns null with no battles, which renders the em-dash placeholder.
function ratingRow(
  label: string,
  compute: (s: MRInputs) => number | null,
  color: (value: number) => RatingColor,
): RowDef {
  return {
    label,
    render: (s, num) => {
      const value = compute({
        battles: s.battles,
        wins: s.wins,
        avgXp: s.battleAvgXp,
      });
      return value === null
        ? EMPTY_CELL
        : { primary: num(INTEGER_FORMAT).format(value), color: color(value) };
    },
  };
}

/**
 * The rating rows for one mode: MR everywhere, and MRB on Rampage alone.
 *
 * MR is the one thing these tabs never had. The WN ratings are built against
 * expected damage measured in random battles, so none of them can read a
 * Skirmish, and the columns came off rather than dashing; MR reads each mode
 * against its own population instead, so 1000 is the median player in all of
 * them. See `computeMR`.
 *
 * MRB stays on Rampage because that is the one board publishing it as a
 * sortable column, and because the volume reward amplifies each mode's battle
 * count distribution rather than normalising it, so one ladder over all seven
 * would not be honest the way `mrColor` is.
 *
 * Both read the same period columns as the rest of the table, and on an ENDED
 * mode every period is empty by construction: Rampage finished in May 2016, so
 * its 24h, 7d and 30d cells are what a finished record looks like rather than a
 * gap. On a live mode MRB's 24h column lands far below the total on purpose, it
 * rewards volume where MR discounts it.
 */
export function modeRatingRows(mode: RatedMode): RowDef[] {
  const mr = ratingRow("MR", (s) => computeMR(mode, s), mrColor);
  return mode === RatedMode.Rampage
    ? [mr, ratingRow("MRB", computeMRB, mrbColor)]
    : [mr];
}

function buildRowDefs(wrColor: WinrateColorFn): RowDef[] {
  return [
  {
    label: "Battles",
    render: (s, num) => ({ primary: num(INTEGER_FORMAT).format(s.battles) }),
  },
  {
    label: "Wins",
    render: (s, num) => ({
      primary: num(INTEGER_FORMAT).format(s.wins),
      secondary: pctOrDash(num, s.wins, s.battles),
      color: s.battles > 0 ? wrColor(s.wins / s.battles) : undefined,
    }),
  },
  {
    label: "Losses",
    render: (s, num) => ({
      primary: num(INTEGER_FORMAT).format(s.losses),
      secondary: pctOrDash(num, s.losses, s.battles),
    }),
  },
  {
    label: "Draws",
    render: (s, num) => ({
      primary: num(INTEGER_FORMAT).format(s.draws),
      secondary: pctOrDash(num, s.draws, s.battles),
    }),
  },
  {
    label: "Battles survived",
    render: (s, num) => ({
      primary: num(INTEGER_FORMAT).format(s.survivedBattles),
      secondary: pctOrDash(num, s.survivedBattles, s.battles),
    }),
  },
  {
    label: "Tanks destroyed",
    render: (s, num) => ({
      primary: num(INTEGER_FORMAT).format(s.frags),
      secondary: avgOrDash(num, s.frags, s.battles),
    }),
  },
  {
    label: "Destruction ratio",
    render: (s, num) => ({
      primary: avgOrDash(num, s.frags, s.battles - s.survivedBattles),
    }),
  },
  {
    label: "Tanks spotted",
    render: (s, num) => ({
      primary: num(INTEGER_FORMAT).format(s.spotted),
      secondary: avgOrDash(num, s.spotted, s.battles),
    }),
  },
  {
    label: "Damages",
    render: (s, num) => ({
      primary: avgOrDash(num, s.damageDealt, s.battles),
    }),
  },
  {
    label: "Base capture",
    render: (s, num) => ({
      primary: num(INTEGER_FORMAT).format(s.capturePoints),
      secondary: avgOrDash(num, s.capturePoints, s.battles),
    }),
  },
  {
    label: "Base defense",
    render: (s, num) => ({
      primary: num(INTEGER_FORMAT).format(s.droppedCapturePoints),
      secondary: avgOrDash(num, s.droppedCapturePoints, s.battles),
    }),
  },
  {
    label: "Experience",
    render: (s, num) => ({
      primary: s.battles > 0 ? num(DECIMAL_FORMAT).format(s.battleAvgXp) : "—",
    }),
  },
  ];
}

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

export type StrongholdPeriods = {
  h24: StrongholdStats | null;
  d7: StrongholdStats | null;
  d30: StrongholdStats | null;
};

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

/** Pass `{ loading }` to render the same shell + row labels with placeholder
 * cells (one `ROW_DEFS`, so the skeleton can't drift from the real table). */
export function StrongholdStatsTable(
  props:
    | { loading: true; trailingRows?: RowDef[]; winrateColorFn?: WinrateColorFn }
    | {
        current: StrongholdStats;
        periods: StrongholdPeriods;
        trailingRows?: RowDef[];
        winrateColorFn?: WinrateColorFn;
      },
) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/detail/overview/stronghold-stats-table");
  const { t: tStats } = useStatLabels();
  const loading = "loading" in props;
  // Mode-specific rows (a mode's MR, plus MRB on Rampage) appended to the shared set,
  // so the skeleton and the real table always render the same labels. The win
  // rate scale is the mode's own median rather than 50%.
  const rows = [
    ...buildRowDefs(props.winrateColorFn ?? winrateColor),
    ...(props.trailingRows ?? []),
  ];
  // Which of the four windows a phone shows, read once and passed down.
  const [period] = useStatsPeriod();
  const off = (p: StrongholdPeriod) => p !== period;
  // Below `sm` the chosen window's two sub-columns take 22% each and the other
  // three windows take none; from `sm` up all four are drawn.
  const colClass = (p: StrongholdPeriod) =>
    cn(off(p) ? "max-sm:w-0!" : "max-sm:w-[22%]", "sm:w-[9%]");
  const headClass = (p: StrongholdPeriod) =>
    cn("text-right", off(p) && styles.hiddenFixedColumn);

  return (
    <Table className="my-0! table-fixed [&_td]:min-w-0 [&_tr>*+*]:border-l [&_tr>*:first-child]:pl-4! [&_tr>*]:border-border [&_th]:py-1! [&_td]:py-0.5!">
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
          <TableHead className={headClass(StrongholdPeriod.Overall)} colSpan={2}>
            {t("total")}</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Day)} colSpan={2}>
            {t("last-24h")}</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Week)} colSpan={2}>
            {t("last-7d")}</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Month)} colSpan={2}>
            {t("last-30d")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const cells = loading
            ? null
            : {
                total: row.render(props.current, num),
                h24: props.periods.h24 ? row.render(props.periods.h24, num) : EMPTY_CELL,
                d7: props.periods.d7 ? row.render(props.periods.d7, num) : EMPTY_CELL,
                d30: props.periods.d30 ? row.render(props.periods.d30, num) : EMPTY_CELL,
              };
          return (
            <TableRow key={row.label}>
              <TableCell className="py-1.5! font-medium">
                <GlossaryLabel label={row.label}>
                  {statLabel(row.label, tStats)}
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
