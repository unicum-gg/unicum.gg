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
import { cn } from "@/lib/utils";
import { computeHR, hrColor, winrateColor, RATING_COLOR_CLASS, type RatingColor, type StrongholdStats } from "@unicum.gg/shared";

// The Wins row colors its win rate with the mode's own scale. Defaults to the
// random-battle 50%-anchored one; Steel Hunter passes its lower-baseline scale
// (top-5 placement, ~41% median) via the table's `winrateColorFn` prop.
export type WinrateColorFn = (wr: number) => RatingColor;

const integerFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Cell = { primary: string; secondary?: string; color?: RatingColor };

const EMPTY_CELL: Cell = { primary: "—" };

function pctOrDash(n: number, d: number): string {
  return d <= 0 ? "—" : percentFmt.format(n / d);
}

function avgOrDash(n: number, d: number): string {
  return d <= 0 ? "—" : decimalFmt.format(n / d);
}

export type RowDef = {
  label: string;
  render: (s: StrongholdStats) => Cell;
};

// Steel Hunter only: the HR rating, colored like the leaderboard. Appended as a
// trailing row for the fallout mode (see StrongholdTab), so the other seven
// stronghold-style modes keep their shared row set untouched. `computeHR`
// returns null with no battles, which renders the em-dash placeholder.
export const HR_ROW: RowDef = {
  label: "HR",
  render: (s) => {
    const hr = computeHR({
      battles: s.battles,
      wins: s.wins,
      avgXp: s.battleAvgXp,
    });
    return hr === null
      ? EMPTY_CELL
      : { primary: integerFmt.format(hr), color: hrColor(hr) };
  },
};

function buildRowDefs(wrColor: WinrateColorFn): RowDef[] {
  return [
  {
    label: "Battles",
    render: (s) => ({ primary: integerFmt.format(s.battles) }),
  },
  {
    label: "Wins",
    render: (s) => ({
      primary: integerFmt.format(s.wins),
      secondary: pctOrDash(s.wins, s.battles),
      color: s.battles > 0 ? wrColor(s.wins / s.battles) : undefined,
    }),
  },
  {
    label: "Losses",
    render: (s) => ({
      primary: integerFmt.format(s.losses),
      secondary: pctOrDash(s.losses, s.battles),
    }),
  },
  {
    label: "Draws",
    render: (s) => ({
      primary: integerFmt.format(s.draws),
      secondary: pctOrDash(s.draws, s.battles),
    }),
  },
  {
    label: "Battles survived",
    render: (s) => ({
      primary: integerFmt.format(s.survivedBattles),
      secondary: pctOrDash(s.survivedBattles, s.battles),
    }),
  },
  {
    label: "Tanks destroyed",
    render: (s) => ({
      primary: integerFmt.format(s.frags),
      secondary: avgOrDash(s.frags, s.battles),
    }),
  },
  {
    label: "Destruction ratio",
    render: (s) => ({
      primary: avgOrDash(s.frags, s.battles - s.survivedBattles),
    }),
  },
  {
    label: "Tanks spotted",
    render: (s) => ({
      primary: integerFmt.format(s.spotted),
      secondary: avgOrDash(s.spotted, s.battles),
    }),
  },
  {
    label: "Damages",
    render: (s) => ({
      primary: avgOrDash(s.damageDealt, s.battles),
    }),
  },
  {
    label: "Base capture",
    render: (s) => ({
      primary: integerFmt.format(s.capturePoints),
      secondary: avgOrDash(s.capturePoints, s.battles),
    }),
  },
  {
    label: "Base defense",
    render: (s) => ({
      primary: integerFmt.format(s.droppedCapturePoints),
      secondary: avgOrDash(s.droppedCapturePoints, s.battles),
    }),
  },
  {
    label: "Experience",
    render: (s) => ({
      primary: s.battles > 0 ? decimalFmt.format(s.battleAvgXp) : "—",
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
  const hide = hideOnMobile ? "max-sm:hidden" : "";
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
      className={cn("py-1.5! text-right", hideOnMobile && "max-sm:hidden")}
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
  const loading = "loading" in props;
  // Mode-specific rows (e.g. the Steel Hunter HR) appended to the shared set,
  // so the skeleton and the real table always render the same labels. The win
  // rate scale is the mode's (Steel Hunter passes its own baseline).
  const rows = [
    ...buildRowDefs(props.winrateColorFn ?? winrateColor),
    ...(props.trailingRows ?? []),
  ];
  return (
    <Table className="my-0! table-fixed [&_td]:min-w-0 [&_tr>*+*]:border-l [&_tr>*:first-child]:pl-4! [&_tr>*]:border-border [&_th]:py-1! [&_td]:py-0.5!">
      <colgroup>
        <col />
        <col className="w-[20%] sm:w-[9%]" />
        <col className="w-[20%] sm:w-[9%]" />
        <col className="max-sm:w-0! sm:w-[9%]" />
        <col className="max-sm:w-0! sm:w-[9%]" />
        <col className="max-sm:w-0! sm:w-[9%]" />
        <col className="max-sm:w-0! sm:w-[9%]" />
        <col className="w-[20%] sm:w-[9%]" />
        <col className="w-[20%] sm:w-[9%]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Stat</TableHead>
          <TableHead className="text-right" colSpan={2}>
            Total
          </TableHead>
          <TableHead className="text-right max-sm:hidden" colSpan={2}>
            Last 24h
          </TableHead>
          <TableHead className="text-right max-sm:hidden" colSpan={2}>
            Last 7d
          </TableHead>
          <TableHead className="text-right" colSpan={2}>
            Last 30d
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const cells = loading
            ? null
            : {
                total: row.render(props.current),
                h24: props.periods.h24 ? row.render(props.periods.h24) : EMPTY_CELL,
                d7: props.periods.d7 ? row.render(props.periods.d7) : EMPTY_CELL,
                d30: props.periods.d30 ? row.render(props.periods.d30) : EMPTY_CELL,
              };
          return (
            <TableRow key={row.label}>
              <TableCell className="py-1.5! font-medium">
                <GlossaryLabel>{row.label}</GlossaryLabel>
              </TableCell>
              {cells ? (
                <>
                  <PeriodCells cell={cells.total} />
                  <PeriodCells cell={cells.h24} hideOnMobile />
                  <PeriodCells cell={cells.d7} hideOnMobile />
                  <PeriodCells cell={cells.d30} />
                </>
              ) : (
                <>
                  <PeriodSkeleton />
                  <PeriodSkeleton hideOnMobile />
                  <PeriodSkeleton hideOnMobile />
                  <PeriodSkeleton />
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
