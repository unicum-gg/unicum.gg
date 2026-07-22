import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type Stats, type PeriodStats, type PeriodValues, type PlayerDerivedStats, RATING_COLOR_CLASS, type RatingColor, winrateColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";

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
  label: string;
  ratingRow?: "wn7" | "wn8" | "wnx";
  cells: (input: RowInput) => PeriodCellSet;
};

function pctOrDash(n: number, d: number): string {
  return d <= 0 ? "—" : percentFmt.format(n / d);
}

function avgOrDash(n: number, d: number): string {
  return d <= 0 ? "—" : decimalFmt.format(n / d);
}

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

// A row whose cells come from the raw account `Stats` (Total from `current`, the
// period columns from the diffs). `renderDelta` formats the period cells when it
// differs from the total (signed values for ratings).
function statRow(
  label: string,
  render: (s: Stats) => Cell,
  renderDelta?: (s: Stats) => Cell,
): RowDef {
  return {
    label,
    cells: ({ current, periods }) => {
      const delta = renderDelta ?? render;
      return {
        total: render(current),
        h24: periods.h24 ? delta(periods.h24) : EMPTY_CELL,
        d7: periods.d7 ? delta(periods.d7) : EMPTY_CELL,
        d30: periods.d30 ? delta(periods.d30) : EMPTY_CELL,
      };
    },
  };
}

// A row whose per-period values are pre-computed server-side (tank-breakdown
// stats: tier, assistance damages, WN7/8/X).
function derivedRow(
  label: string,
  pick: (d: PlayerDerivedStats) => PeriodValues,
  options: { color?: (v: number) => RatingColor; ratingRow?: RowDef["ratingRow"] } = {},
): RowDef {
  return {
    label,
    ratingRow: options.ratingRow,
    cells: ({ derived }) => cellsFrom(pick(derived), options.color),
  };
}

// The single source of truth for the table's rows and their order (Tier after
// Battles, the four damage-breakdown rows after Damages, ratings last).
const ROWS: RowDef[] = [
  statRow("Battles", (s) => ({ primary: integerFmt.format(s.battles) })),
  derivedRow("Tier", (d) => d.tier),
  statRow("Wins", (s) => ({
    primary: integerFmt.format(s.wins),
    secondary: pctOrDash(s.wins, s.battles),
    color: s.battles > 0 ? winrateColor(s.wins / s.battles) : undefined,
  })),
  statRow("Losses", (s) => ({
    primary: integerFmt.format(s.losses),
    secondary: pctOrDash(s.losses, s.battles),
  })),
  statRow("Draws", (s) => ({
    primary: integerFmt.format(s.draws),
    secondary: pctOrDash(s.draws, s.battles),
  })),
  statRow("Battles survived", (s) => ({
    primary: integerFmt.format(s.survivedBattles),
    secondary: pctOrDash(s.survivedBattles, s.battles),
  })),
  statRow("Tanks destroyed", (s) => ({
    primary: integerFmt.format(s.frags),
    secondary: avgOrDash(s.frags, s.battles),
  })),
  statRow("Destruction ratio", (s) => ({
    primary: avgOrDash(s.frags, s.battles - s.survivedBattles),
  })),
  statRow("Tanks spotted", (s) => ({
    primary: integerFmt.format(s.spotted),
    secondary: avgOrDash(s.spotted, s.battles),
  })),
  statRow("Damages", (s) => ({
    primary: avgOrDash(s.damageDealt, s.battles),
  })),
  derivedRow("Track damages", (d) => d.trackDamage),
  derivedRow("Spotting damages", (d) => d.spottingDamage),
  derivedRow("Assisting damages", (d) => d.assistingDamage),
  derivedRow("Combined damages", (d) => d.combinedDamage),
  statRow("Base capture", (s) => ({
    primary: integerFmt.format(s.capturePoints),
    secondary: avgOrDash(s.capturePoints, s.battles),
  })),
  statRow("Base defense", (s) => ({
    primary: integerFmt.format(s.droppedCapturePoints),
    secondary: avgOrDash(s.droppedCapturePoints, s.battles),
  })),
  statRow("Experience", (s) => ({
    primary: avgOrDash(s.xp, s.battles),
  })),
  statRow("Hit rate", (s) => ({
    primary: pctOrDash(s.hits, s.shots),
  })),
  statRow(
    "Personal rating",
    (s) => ({ primary: integerFmt.format(s.globalRating) }),
    (s) => ({
      primary: signedIntegerFmt.format(s.globalRating),
      className:
        s.globalRating > 0
          ? "text-emerald-500"
          : s.globalRating < 0
            ? "text-red-500"
            : undefined,
    }),
  ),
  statRow(
    "World of Tanks Rating",
    (s) => ({ primary: s.wtr === null ? "—" : integerFmt.format(s.wtr) }),
    (s) => ({
      primary: s.wtr === null ? "—" : signedIntegerFmt.format(s.wtr),
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
  derivedRow("WN7", (d) => d.wn7, { color: wn7Color, ratingRow: "wn7" }),
  derivedRow("WN8", (d) => d.wn8, { color: wn8Color, ratingRow: "wn8" }),
  derivedRow("WNX", (d) => d.wnx, { color: wnxColor, ratingRow: "wnx" }),
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
  const loading = "loading" in props;

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
        {ROWS.map((row) => {
          const cells = loading ? null : row.cells(props);
          return (
            <TableRow
              key={row.label}
              data-rating-row={row.ratingRow}
            >
              <TableCell className="py-1.5! font-medium">{row.label}</TableCell>
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
