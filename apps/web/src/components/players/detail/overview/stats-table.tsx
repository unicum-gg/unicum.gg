"use client";

import type { ReactNode } from "react";
import type { Region } from "@unicum.gg/wargaming";
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
import { useStatWindows } from "@/hooks/use-stat-windows";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  RATING_COLOR_CLASS,
  StrongholdPeriod,
  type PeriodStats,
  type PlayerDerivedStats,
  type Stats,
} from "@unicum.gg/shared";
import { useTranslation } from "@/hooks/use-translation";
import { ROWS, type Cell, type StatColumn } from "./stats-table-rows";
import { StatWindowHead } from "@/components/stat-window/head";
import { derivedColumn, useStatWindowColumn } from "./use-stat-window-column";

const NAMESPACE = "components/players/detail/overview/stats-table";

/** The phone's window picker names the slots by the periods it shares with
 * every other stats table; on this one each slot is a column the reader set. */
const SLOT_PERIODS = [
  StrongholdPeriod.Day,
  StrongholdPeriod.Week,
  StrongholdPeriod.Month,
] as const;
const SLOTS = [0, 1, 2] as const;

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

type HeaderDef = { period: StrongholdPeriod; content: ReactNode };

/**
 * The table's frame: headings, the row labels, one cell per column. A column
 * left null draws skeletons, so the loading table and a custom window on its
 * way are the same shell.
 */
function StatsTableShell({
  headers,
  columns,
}: {
  headers: HeaderDef[];
  columns: (StatColumn | null)[];
}) {
  const { num } = useFormat();
  const { t } = useTranslation(NAMESPACE);
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
        {headers.map((h) => (
          <ColPair key={h.period} className={colClass(h.period)} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>{t("stat")}</TableHead>
          {headers.map((h) => (
            <TableHead
              key={h.period}
              className={cn("text-right", off(h.period) && styles.hiddenFixedColumn)}
              colSpan={2}
            >
              {h.content}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.id} data-rating-row={row.ratingRow}>
            <TableCell className="py-1.5! font-medium">
              <GlossaryLabel label={row.term ?? row.label}>
                {t(`rows.${row.id}`)}
              </GlossaryLabel>
            </TableCell>
            {columns.map((column, i) => {
              const hide = off(headers[i].period);
              return column ? (
                <PeriodCells
                  key={headers[i].period}
                  cell={row.cell(column, num)}
                  hideOnMobile={hide}
                />
              ) : (
                <PeriodSkeleton key={headers[i].period} hideOnMobile={hide} />
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ColPair({ className }: { className: string }) {
  return (
    <>
      <col className={className} />
      <col className={className} />
    </>
  );
}

type LoadedProps = {
  region: Region;
  nickname: string;
  current: Stats;
  periods: PeriodStats;
  derived: PlayerDerivedStats;
};

function LoadedStatsTable({ region, nickname, current, periods, derived }: LoadedProps) {
  const { t } = useTranslation(NAMESPACE);
  const [windows] = useStatWindows();
  // One call per slot, always three: hooks cannot follow a loop over data.
  const slots = [
    useStatWindowColumn({ region, nickname, window: windows[0], periods, derived }),
    useStatWindowColumn({ region, nickname, window: windows[1], periods, derived }),
    useStatWindowColumn({ region, nickname, window: windows[2], periods, derived }),
  ];
  const headers: HeaderDef[] = [
    { period: StrongholdPeriod.Overall, content: t("periods.total") },
    ...SLOTS.map((i) => ({
      period: SLOT_PERIODS[i],
      content: (
        <StatWindowHead slot={i} truncated={slots[i].truncated} from={slots[i].from} />
      ),
    })),
  ];
  const columns: (StatColumn | null)[] = [
    { stats: current, derived: derivedColumn(derived, "total"), lifetime: true },
    ...slots.map((s) => s.column),
  ];
  return <StatsTableShell headers={headers} columns={columns} />;
}

function LoadingStatsTable() {
  const { t } = useTranslation(NAMESPACE);
  const headers: HeaderDef[] = [
    { period: StrongholdPeriod.Overall, content: t("periods.total") },
    ...SLOTS.map((i) => ({
      period: SLOT_PERIODS[i],
      content: <StatWindowHead slot={i} editable={false} />,
    })),
  ];
  return <StatsTableShell headers={headers} columns={[null, null, null, null]} />;
}

/**
 * The random-battles stats table. The career column and the three default
 * windows arrive pre-computed with the profile; a window the reader set
 * through a column's pencil is read from the period endpoint. Pass
 * `{ loading }` to render the same shell and row labels with placeholder
 * cells — one row list, so the skeleton can't drift from the real table.
 */
export function PlayerStatsTable(props: { loading: true } | LoadedProps) {
  return "loading" in props ? <LoadingStatsTable /> : <LoadedStatsTable {...props} />;
}
