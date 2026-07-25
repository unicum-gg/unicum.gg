import { Fragment } from "react";
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
import { RATING_COLOR_CLASS, RatingColor, type ClanGlobalMapStats, type ClanGlobalMapView } from "@unicum.gg/shared";

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
};

// One section per Global Map front, mirroring the stronghold table: each tier
// keeps its ELO/battles/win rate together under a header, plus a "Territory"
// section for the global province count. No links (there's no Clan Wars
// leaderboard yet — that comes later).
const SECTIONS: { title: string; rows: RowDef[] }[] = [
  {
    title: "Territory",
    rows: [
      {
        label: "Provinces",
        current: (s) => provincesCell(s.gmProvinces),
        delta: (s) => provincesCell(s.gmProvinces, s.gmProvinces),
      },
    ],
  },
  {
    title: "Tier X",
    rows: [
      {
        label: "ELO",
        current: (s) => eloCell(s.gmEloT10),
        delta: (s) => eloCell(s.gmEloT10, s.gmEloT10),
      },
      {
        label: "Battles",
        current: (s) => battlesCell(s.gmBattlesT10),
        delta: (s) => battlesCell(s.gmBattlesT10, s.gmBattlesT10),
      },
      {
        label: "Win rate",
        current: (s) => wrCell(s.gmWinsT10, s.gmBattlesT10),
        delta: (s) => wrCell(s.gmWinsT10, s.gmBattlesT10),
      },
    ],
  },
  {
    title: "Tier VIII",
    rows: [
      {
        label: "ELO",
        current: (s) => eloCell(s.gmEloT8),
        delta: (s) => eloCell(s.gmEloT8, s.gmEloT8),
      },
      {
        label: "Battles",
        current: (s) => battlesCell(s.gmBattlesT8),
        delta: (s) => battlesCell(s.gmBattlesT8, s.gmBattlesT8),
      },
      {
        label: "Win rate",
        current: (s) => wrCell(s.gmWinsT8, s.gmBattlesT8),
        delta: (s) => wrCell(s.gmWinsT8, s.gmBattlesT8),
      },
    ],
  },
  {
    title: "Tier VI",
    rows: [
      {
        label: "ELO",
        current: (s) => eloCell(s.gmEloT6),
        delta: (s) => eloCell(s.gmEloT6, s.gmEloT6),
      },
      {
        label: "Battles",
        current: (s) => battlesCell(s.gmBattlesT6),
        delta: (s) => battlesCell(s.gmBattlesT6, s.gmBattlesT6),
      },
      {
        label: "Win rate",
        current: (s) => wrCell(s.gmWinsT6, s.gmBattlesT6),
        delta: (s) => wrCell(s.gmWinsT6, s.gmBattlesT6),
      },
    ],
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

/** A period-cell placeholder, right-aligned like the real number. */
function PeriodSkeleton({ hideOnMobile }: { hideOnMobile?: boolean }) {
  return (
    <TableCell
      className={cn("py-1.5! text-right", hideOnMobile && "max-sm:hidden")}
    >
      <Skeleton className="ml-auto h-4 w-12" />
    </TableCell>
  );
}

export function ClanWarsStatsTable(
  props:
    | { loading: true }
    | { latest: ClanGlobalMapStats; periods: ClanGlobalMapView["periods"] },
) {
  const loading = "loading" in props;

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
        {SECTIONS.map((section) => (
          <Fragment key={section.title}>
            <TableRow>
              <TableCell
                colSpan={5}
                className="bg-muted/40 py-1! text-xs font-semibold text-muted-foreground uppercase"
              >
                {section.title}
              </TableCell>
            </TableRow>
            {section.rows.map((row) => (
              <TableRow key={section.title + row.label}>
                <TableCell className="py-1.5! font-medium">
                  {row.label}
                </TableCell>
                {loading ? (
                  <>
                    <PeriodSkeleton />
                    <PeriodSkeleton hideOnMobile />
                    <PeriodSkeleton hideOnMobile />
                    <PeriodSkeleton />
                  </>
                ) : (
                  <>
                    <PeriodCell cell={row.current(props.latest)} />
                    <PeriodCell
                      cell={
                        props.periods.h24 ? row.delta(props.periods.h24) : DASH
                      }
                      hideOnMobile
                    />
                    <PeriodCell
                      cell={props.periods.d7 ? row.delta(props.periods.d7) : DASH}
                      hideOnMobile
                    />
                    <PeriodCell
                      cell={
                        props.periods.d30 ? row.delta(props.periods.d30) : DASH
                      }
                    />
                  </>
                )}
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
