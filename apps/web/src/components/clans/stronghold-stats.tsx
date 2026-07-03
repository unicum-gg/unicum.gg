import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  RATING_COLOR_CLASS,
  strongholdWinrateColor,
} from "@/services/wargaming/wot/ratings";
import type {
  ClanStrongholdStats,
  ClanSnapshotPeriods,
} from "@/services/clans/snapshot-stats";
import {
  diffClanStrongholdStats,
  strongholdStatsFromClanSnapshot,
} from "@/services/clans/snapshot-stats";
import type { ClanSnapshot } from "@/services/db/schema";

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

function wrCell(wins: number | null, battles: number | null): Cell {
  if (wins === null || battles === null || battles === 0)
    return { primary: "—", className: "text-muted-foreground" };
  const ratio = wins / battles;
  return {
    primary: pctFmt.format(ratio),
    className: RATING_COLOR_CLASS[strongholdWinrateColor(ratio)],
  };
}

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
  if (delta !== undefined) {
    return { primary: delta !== null ? intFmt.format(delta) : "—" };
  }
  return { primary: intFmt.format(val) };
}

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

type RowDef = {
  label: string;
  current: (s: ClanStrongholdStats) => Cell;
  delta: (s: ClanStrongholdStats) => Cell;
  separator?: boolean;
};

const ROWS: RowDef[] = [
  {
    label: "ELO T10",
    current: (s) => eloCell(s.eloT10),
    delta: (s) => eloCell(s.eloT10, s.eloT10),
  },
  {
    label: "Advances T10",
    current: (s) => battlesCell(s.advancesBattlesT10),
    delta: (s) => battlesCell(s.advancesBattlesT10, s.advancesBattlesT10),
  },
  {
    label: "Advances T10 WR",
    current: (s) => wrCell(s.advancesWinsT10, s.advancesBattlesT10),
    delta: (s) => wrCell(s.advancesWinsT10, s.advancesBattlesT10),
  },
  {
    label: "Skirmish T10",
    current: (s) => battlesCell(s.skirmishBattlesT10),
    delta: (s) => battlesCell(s.skirmishBattlesT10, s.skirmishBattlesT10),
  },
  {
    label: "Skirmish T10 WR",
    current: (s) => wrCell(s.skirmishWinsT10, s.skirmishBattlesT10),
    delta: (s) => wrCell(s.skirmishWinsT10, s.skirmishBattlesT10),
  },
  {
    label: "ELO T8",
    separator: true,
    current: (s) => eloCell(s.eloT8),
    delta: (s) => eloCell(s.eloT8, s.eloT8),
  },
  {
    label: "Skirmish T8",
    current: (s) => battlesCell(s.skirmishBattlesT8),
    delta: (s) => battlesCell(s.skirmishBattlesT8, s.skirmishBattlesT8),
  },
  {
    label: "Skirmish T8 WR",
    current: (s) => wrCell(s.skirmishWinsT8, s.skirmishBattlesT8),
    delta: (s) => wrCell(s.skirmishWinsT8, s.skirmishBattlesT8),
  },
  {
    label: "ELO T6",
    separator: true,
    current: (s) => eloCell(s.eloT6),
    delta: (s) => eloCell(s.eloT6, s.eloT6),
  },
  {
    label: "Skirmish T6",
    current: (s) => battlesCell(s.skirmishBattlesT6),
    delta: (s) => battlesCell(s.skirmishBattlesT6, s.skirmishBattlesT6),
  },
  {
    label: "Skirmish T6 WR",
    current: (s) => wrCell(s.skirmishWinsT6, s.skirmishBattlesT6),
    delta: (s) => wrCell(s.skirmishWinsT6, s.skirmishBattlesT6),
  },
];

function computePeriod(
  current: ClanStrongholdStats,
  snap: ClanSnapshot | null,
): ClanStrongholdStats | null {
  if (!snap) return null;
  return diffClanStrongholdStats(current, strongholdStatsFromClanSnapshot(snap));
}

export function ClanStrongholdStatsTable({
  latest,
  periods,
}: {
  latest: ClanSnapshot;
  periods: ClanSnapshotPeriods;
}) {
  const current = strongholdStatsFromClanSnapshot(latest);
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
