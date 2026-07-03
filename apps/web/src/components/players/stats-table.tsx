import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { type Stats } from "@/services/players";
import type {
  PeriodStats,
  PeriodValues,
  PlayerDerivedStats,
} from "@/services/players/derived-stats";
import {
  RATING_COLOR_CLASS,
  type RatingColor,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@/services/wargaming/wot/ratings";

const integerFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const signedIntegerFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const decimalFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Cell = { primary: string; secondary?: string; color?: RatingColor; className?: string };

const EMPTY_CELL: Cell = { primary: "—" };

type RowDef = {
  label: string;
  render: (s: Stats) => Cell;
  renderDelta?: (s: Stats) => Cell;
};

function pctOrDash(n: number, d: number): string {
  return d <= 0 ? "—" : percentFmt.format(n / d);
}

function avgOrDash(n: number, d: number): string {
  return d <= 0 ? "—" : decimalFmt.format(n / d);
}

const ROW_DEFS: RowDef[] = [
  {
    label: "Battles",
    render: (s) => ({ primary: integerFmt.format(s.battles) }),
  },
  {
    label: "Wins",
    render: (s) => ({
      primary: integerFmt.format(s.wins),
      secondary: pctOrDash(s.wins, s.battles),
      color: s.battles > 0 ? winrateColor(s.wins / s.battles) : undefined,
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
      primary: avgOrDash(s.xp, s.battles),
    }),
  },
  {
    label: "Hit rate",
    render: (s) => ({
      primary: pctOrDash(s.hits, s.shots),
    }),
  },
  {
    label: "Personal rating",
    render: (s) => ({ primary: integerFmt.format(s.globalRating) }),
    renderDelta: (s) => ({
      primary: signedIntegerFmt.format(s.globalRating),
      className: s.globalRating > 0 ? "text-emerald-500" : s.globalRating < 0 ? "text-red-500" : undefined,
    }),
  },
  {
    label: "World of Tanks Rating",
    render: (s) => ({
      primary: s.wtr === null ? "—" : integerFmt.format(s.wtr),
    }),
    renderDelta: (s) => ({
      primary: s.wtr === null ? "—" : signedIntegerFmt.format(s.wtr),
      className: s.wtr === null ? undefined : s.wtr > 0 ? "text-emerald-500" : s.wtr < 0 ? "text-red-500" : undefined,
    }),
  },
];

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

type PeriodCellSet = { total: Cell; h24: Cell; d7: Cell; d30: Cell };

// Turns the server-computed numeric values into display cells, optionally
// color-coding them with the matching rating scale.
function cellsFrom(
  values: PeriodValues,
  color?: (v: number) => RatingColor,
): PeriodCellSet {
  const cell = (value: number | null): Cell => {
    if (value === null) return EMPTY_CELL;
    return {
      primary: decimalFmt.format(value),
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

export function PlayerStatsTable({
  current,
  periods,
  derived,
}: {
  current: Stats;
  periods: PeriodStats;
  derived: PlayerDerivedStats;
}) {
  // All tank-breakdown rows arrive pre-computed from the server (see
  // services/players/derived-stats); this component only formats them.
  const tierCells = cellsFrom(derived.tier);
  const trackDmgCells = cellsFrom(derived.trackDamage);
  const spottingDmgCells = cellsFrom(derived.spottingDamage);
  const assistingDmgCells = cellsFrom(derived.assistingDamage);
  const combinedDmgCells = cellsFrom(derived.combinedDamage);
  const wn7Cells = cellsFrom(derived.wn7, wn7Color);
  const wn8Cells = cellsFrom(derived.wn8, wn8Color);
  const wnxCells = cellsFrom(derived.wnx, wnxColor);

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
          {ROW_DEFS.flatMap((row) => {
            const deltaRender = row.renderDelta ?? row.render;
            const total = row.render(current);
            const h24 = periods.h24 ? deltaRender(periods.h24) : EMPTY_CELL;
            const d7 = periods.d7 ? deltaRender(periods.d7) : EMPTY_CELL;
            const d30 = periods.d30 ? deltaRender(periods.d30) : EMPTY_CELL;
            const rowEl = (
              <TableRow key={row.label}>
                <TableCell className="py-1.5! font-medium">{row.label}</TableCell>
                <PeriodCells cell={total} />
                <PeriodCells cell={h24} hideOnMobile />
                <PeriodCells cell={d7} hideOnMobile />
                <PeriodCells cell={d30} />
              </TableRow>
            );
            if (row.label === "Battles") {
              return [
                rowEl,
                <TableRow key="Tier">
                  <TableCell className="py-1.5! font-medium">Tier</TableCell>
                  <PeriodCells cell={tierCells.total} />
                  <PeriodCells cell={tierCells.h24} hideOnMobile />
                  <PeriodCells cell={tierCells.d7} hideOnMobile />
                  <PeriodCells cell={tierCells.d30} />
                </TableRow>,
              ];
            }
            if (row.label === "Damages") {
              return [
                rowEl,
                <TableRow key="Track damages">
                  <TableCell className="py-1.5! font-medium">Track damages</TableCell>
                  <PeriodCells cell={trackDmgCells.total} />
                  <PeriodCells cell={trackDmgCells.h24} hideOnMobile />
                  <PeriodCells cell={trackDmgCells.d7} hideOnMobile />
                  <PeriodCells cell={trackDmgCells.d30} />
                </TableRow>,
                <TableRow key="Spotting damages">
                  <TableCell className="py-1.5! font-medium">Spotting damages</TableCell>
                  <PeriodCells cell={spottingDmgCells.total} />
                  <PeriodCells cell={spottingDmgCells.h24} hideOnMobile />
                  <PeriodCells cell={spottingDmgCells.d7} hideOnMobile />
                  <PeriodCells cell={spottingDmgCells.d30} />
                </TableRow>,
                <TableRow key="Assisting damages">
                  <TableCell className="py-1.5! font-medium">Assisting damages</TableCell>
                  <PeriodCells cell={assistingDmgCells.total} />
                  <PeriodCells cell={assistingDmgCells.h24} hideOnMobile />
                  <PeriodCells cell={assistingDmgCells.d7} hideOnMobile />
                  <PeriodCells cell={assistingDmgCells.d30} />
                </TableRow>,
                <TableRow key="Combined damages">
                  <TableCell className="py-1.5! font-medium">Combined damages</TableCell>
                  <PeriodCells cell={combinedDmgCells.total} />
                  <PeriodCells cell={combinedDmgCells.h24} hideOnMobile />
                  <PeriodCells cell={combinedDmgCells.d7} hideOnMobile />
                  <PeriodCells cell={combinedDmgCells.d30} />
                </TableRow>,
              ];
            }
            return [rowEl];
          })}
          <TableRow key="WN7" data-rating-row="wn7">
            <TableCell className="py-1.5! font-medium">WN7</TableCell>
            <PeriodCells cell={wn7Cells.total} />
            <PeriodCells cell={wn7Cells.h24} hideOnMobile />
            <PeriodCells cell={wn7Cells.d7} hideOnMobile />
            <PeriodCells cell={wn7Cells.d30} />
          </TableRow>
          <TableRow key="WN8" data-rating-row="wn8">
            <TableCell className="py-1.5! font-medium">WN8</TableCell>
            <PeriodCells cell={wn8Cells.total} />
            <PeriodCells cell={wn8Cells.h24} hideOnMobile />
            <PeriodCells cell={wn8Cells.d7} hideOnMobile />
            <PeriodCells cell={wn8Cells.d30} />
          </TableRow>
          <TableRow key="WNX" data-rating-row="wnx">
            <TableCell className="py-1.5! font-medium">WNX</TableCell>
            <PeriodCells cell={wnxCells.total} />
            <PeriodCells cell={wnxCells.h24} hideOnMobile />
            <PeriodCells cell={wnxCells.d7} hideOnMobile />
            <PeriodCells cell={wnxCells.d30} />
          </TableRow>
        </TableBody>
    </Table>
  );
}
