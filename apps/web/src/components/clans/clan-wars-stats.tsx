import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { RATING_COLOR_CLASS, RatingColor } from "@unicum.gg/core/wargaming/wot/ratings";
import type {
  ClanGlobalMapStats,
  ClanSnapshotPeriods,
} from "@unicum.gg/core/clans/snapshot-stats";
import {
  diffClanGlobalMapStats,
  globalMapStatsFromClanSnapshot,
} from "@unicum.gg/core/clans/snapshot-stats";
import type { ClanSnapshot } from "@unicum.gg/core/db/schema";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const signedIntFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Cell = { primary: string; className?: string };
const DASH: Cell = { primary: "—", className: "text-muted-foreground" };

function eloCell(val: number | null, delta?: number | null): Cell {
  if (val === null) return DASH;
  if (delta !== undefined) {
    return {
      primary: delta !== null ? signedIntFmt.format(delta) : "—",
      className:
        delta === null
          ? "text-muted-foreground"
          : delta > 0
            ? "text-emerald-500"
            : delta < 0
              ? "text-red-500"
              : "text-muted-foreground",
    };
  }
  return { primary: intFmt.format(val) };
}

function battlesCell(val: number | null, delta?: number | null): Cell {
  if (val === null) return DASH;
  if (delta !== undefined) return { primary: delta !== null ? intFmt.format(delta) : "—" };
  return { primary: intFmt.format(val) };
}

function provincesCell(val: number | null, delta?: number | null): Cell {
  if (val === null) return DASH;
  if (delta !== undefined) {
    return {
      primary: delta !== null ? signedIntFmt.format(delta) : "—",
      className:
        delta === null
          ? "text-muted-foreground"
          : delta > 0
            ? "text-emerald-500"
            : delta < 0
              ? "text-red-500"
              : "text-muted-foreground",
    };
  }
  return { primary: intFmt.format(val) };
}

function gwWrColor(ratio: number): RatingColor {
  if (ratio >= 0.70) return RatingColor.Excellent;
  if (ratio >= 0.60) return RatingColor.Super;
  if (ratio >= 0.55) return RatingColor.Good;
  if (ratio >= 0.50) return RatingColor.Average;
  if (ratio >= 0.45) return RatingColor.BelowAvg;
  return RatingColor.Bad;
}

function wrCell(wins: number | null, battles: number | null): Cell {
  if (wins === null || battles === null || battles === 0)
    return { primary: "—", className: "text-muted-foreground" };
  const ratio = wins / battles;
  return {
    primary: pctFmt.format(ratio),
    className: RATING_COLOR_CLASS[gwWrColor(ratio)],
  };
}

type RowDef = {
  label: string;
  current: (s: ClanGlobalMapStats) => Cell;
  delta: (s: ClanGlobalMapStats) => Cell;
  separator?: boolean;
};

const ROWS: RowDef[] = [
  {
    label: "Provinces",
    current: (s) => provincesCell(s.gmProvinces),
    delta: (s) => provincesCell(s.gmProvinces, s.gmProvinces),
  },
  {
    label: "ELO T10",
    current: (s) => eloCell(s.gmEloT10),
    delta: (s) => eloCell(s.gmEloT10, s.gmEloT10),
    separator: true,
  },
  {
    label: "Battles T10",
    current: (s) => battlesCell(s.gmBattlesT10),
    delta: (s) => battlesCell(s.gmBattlesT10, s.gmBattlesT10),
  },
  {
    label: "Win rate T10",
    current: (s) => wrCell(s.gmWinsT10, s.gmBattlesT10),
    delta: (s) => wrCell(s.gmWinsT10, s.gmBattlesT10),
  },
  {
    label: "ELO T8",
    current: (s) => eloCell(s.gmEloT8),
    delta: (s) => eloCell(s.gmEloT8, s.gmEloT8),
    separator: true,
  },
  {
    label: "Battles T8",
    current: (s) => battlesCell(s.gmBattlesT8),
    delta: (s) => battlesCell(s.gmBattlesT8, s.gmBattlesT8),
  },
  {
    label: "Win rate T8",
    current: (s) => wrCell(s.gmWinsT8, s.gmBattlesT8),
    delta: (s) => wrCell(s.gmWinsT8, s.gmBattlesT8),
  },
  {
    label: "ELO T6",
    current: (s) => eloCell(s.gmEloT6),
    delta: (s) => eloCell(s.gmEloT6, s.gmEloT6),
    separator: true,
  },
  {
    label: "Battles T6",
    current: (s) => battlesCell(s.gmBattlesT6),
    delta: (s) => battlesCell(s.gmBattlesT6, s.gmBattlesT6),
  },
  {
    label: "Win rate T6",
    current: (s) => wrCell(s.gmWinsT6, s.gmBattlesT6),
    delta: (s) => wrCell(s.gmWinsT6, s.gmBattlesT6),
  },
];

function PeriodCell({ cell, hideOnMobile }: { cell: Cell; hideOnMobile?: boolean }) {
  return (
    <TableCell
      className={cn(
        "py-1.5! text-right tabular-nums",
        hideOnMobile && "max-sm:hidden",
        cell.className,
      )}
    >
      {cell.primary}
    </TableCell>
  );
}

function computePeriod(
  current: ClanGlobalMapStats,
  snap: ClanSnapshot | null,
): ClanGlobalMapStats | null {
  if (!snap) return null;
  return diffClanGlobalMapStats(current, globalMapStatsFromClanSnapshot(snap));
}

export function ClanWarsStatsTable({
  latest,
  periods,
}: {
  latest: ClanSnapshot;
  periods: ClanSnapshotPeriods;
}) {
  const current = globalMapStatsFromClanSnapshot(latest);
  const p24 = computePeriod(current, periods.h24);
  const p7 = computePeriod(current, periods.d7);
  const p30 = computePeriod(current, periods.d30);

  return (
    <Table className="my-0! table-fixed [&_td]:min-w-0 [&_tr>*+*]:border-l [&_tr>*:first-child]:pl-4! [&_tr>*]:border-border [&_th]:py-1! [&_td]:py-0.5!">
      <colgroup>
        <col />
        <col className="w-[20%] sm:w-[12%]" />
        <col className="max-sm:w-0! sm:w-[12%]" />
        <col className="max-sm:w-0! sm:w-[12%]" />
        <col className="w-[20%] sm:w-[12%]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Stat</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right max-sm:hidden">Last 24h</TableHead>
          <TableHead className="text-right max-sm:hidden">Last 7d</TableHead>
          <TableHead className="text-right">Last 30d</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <>
            {row.separator && (
              <TableRow key={`${row.label}-sep`}>
                <td colSpan={5} className="h-px bg-border p-0!" />
              </TableRow>
            )}
            <TableRow key={row.label}>
              <TableCell className="py-1.5! font-medium">{row.label}</TableCell>
              <PeriodCell cell={row.current(current)} />
              <PeriodCell cell={p24 ? row.delta(p24) : DASH} hideOnMobile />
              <PeriodCell cell={p7 ? row.delta(p7) : DASH} hideOnMobile />
              <PeriodCell cell={p30 ? row.delta(p30) : DASH} />
            </TableRow>
          </>
        ))}
      </TableBody>
    </Table>
  );
}
