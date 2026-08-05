import { Fragment } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import { RATING_COLOR_CLASS, strongholdWinrateColor, StrongholdTier, type ClanStrongholdStats, type ClanStrongholdView } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

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

type ProjectionRow = {
  label: string;
  current: (s: ClanStrongholdStats) => Cell;
  delta: (s: ClanStrongholdStats) => Cell;
};
// SR is a current absolute rating (not a per-period diff) and the materialized
// table only holds the overall value, so an SR row fills the "Total" column and
// dashes 24h/7d/30d. Keyed by the tiers of `ClanStrongholdView["sr"]`.
type SrRow = { label: string; sr: keyof NonNullable<ClanStrongholdView["sr"]> };
type SectionRow = ProjectionRow | SrRow;

// One section per stronghold mode, mirroring the leaderboards, so each mode keeps
// its own stats together (SR, ELO, battles, win rate) under a header rather than
// scattering them. Advances shares Skirmish T10's ELO, so it lists no ELO row.
const SECTIONS: { title: string; tier: StrongholdTier; rows: SectionRow[] }[] = [
  {
    title: "Advances (15v15)",
    tier: StrongholdTier.Advances,
    rows: [
      { label: "SR", sr: "advances" },
      {
        label: "Battles",
        current: (s) => battlesCell(s.advancesBattlesT10),
        delta: (s) => battlesCell(s.advancesBattlesT10, s.advancesBattlesT10),
      },
      {
        label: "Win rate",
        current: (s) => wrCell(s.advancesWinsT10, s.advancesBattlesT10),
        delta: (s) => wrCell(s.advancesWinsT10, s.advancesBattlesT10),
      },
    ],
  },
  {
    title: "Skirmish Tier X (7v7)",
    tier: StrongholdTier.T10,
    rows: [
      { label: "SR", sr: "t10" },
      {
        label: "ELO",
        current: (s) => eloCell(s.eloT10),
        delta: (s) => eloCell(s.eloT10, s.eloT10),
      },
      {
        label: "Battles",
        current: (s) => battlesCell(s.skirmishBattlesT10),
        delta: (s) => battlesCell(s.skirmishBattlesT10, s.skirmishBattlesT10),
      },
      {
        label: "Win rate",
        current: (s) => wrCell(s.skirmishWinsT10, s.skirmishBattlesT10),
        delta: (s) => wrCell(s.skirmishWinsT10, s.skirmishBattlesT10),
      },
    ],
  },
  {
    title: "Skirmish Tier VIII (7v7)",
    tier: StrongholdTier.T8,
    rows: [
      { label: "SR", sr: "t8" },
      {
        label: "ELO",
        current: (s) => eloCell(s.eloT8),
        delta: (s) => eloCell(s.eloT8, s.eloT8),
      },
      {
        label: "Battles",
        current: (s) => battlesCell(s.skirmishBattlesT8),
        delta: (s) => battlesCell(s.skirmishBattlesT8, s.skirmishBattlesT8),
      },
      {
        label: "Win rate",
        current: (s) => wrCell(s.skirmishWinsT8, s.skirmishBattlesT8),
        delta: (s) => wrCell(s.skirmishWinsT8, s.skirmishBattlesT8),
      },
    ],
  },
  {
    title: "Skirmish Tier VI (7v7)",
    tier: StrongholdTier.T6,
    rows: [
      { label: "SR", sr: "t6" },
      {
        label: "ELO",
        current: (s) => eloCell(s.eloT6),
        delta: (s) => eloCell(s.eloT6, s.eloT6),
      },
      {
        label: "Battles",
        current: (s) => battlesCell(s.skirmishBattlesT6),
        delta: (s) => battlesCell(s.skirmishBattlesT6, s.skirmishBattlesT6),
      },
      {
        label: "Win rate",
        current: (s) => wrCell(s.skirmishWinsT6, s.skirmishBattlesT6),
        delta: (s) => wrCell(s.skirmishWinsT6, s.skirmishBattlesT6),
      },
    ],
  },
];

function srCell(v: number | null): Cell {
  if (v === null) return DASH;
  return { primary: intFmt.format(v), className: "font-bold" };
}

export function ClanStrongholdStatsTable(
  props:
    | { loading: true }
    | {
        region: Region;
        latest: ClanStrongholdStats;
        periods: ClanStrongholdView["periods"];
        sr: ClanStrongholdView["sr"];
      },
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
              <TableCell colSpan={5} className="bg-muted/40 p-0!">
                {loading ? (
                  <span className="block px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">
                    {section.title}
                  </span>
                ) : (
                  // The header links to this mode's leaderboard — a contextual
                  // funnel from every indexed clan page to the stronghold boards.
                  <Link
                    href={ROUTES.STRONGHOLD(props.region, section.tier)}
                    className="group flex items-center gap-1 px-4 py-1 text-xs font-semibold text-muted-foreground uppercase transition-colors hover:text-foreground"
                  >
                    {section.title}
                    <CaretRightIcon
                      weight="bold"
                      className="size-3 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                )}
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
                ) : "sr" in row ? (
                  <>
                    <PeriodCell
                      cell={srCell(props.sr ? props.sr[row.sr] : null)}
                    />
                    <PeriodCell cell={DASH} hideOnMobile />
                    <PeriodCell cell={DASH} hideOnMobile />
                    <PeriodCell cell={DASH} />
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
