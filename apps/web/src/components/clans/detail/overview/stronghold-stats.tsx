"use client";

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
import { GlossaryLabel } from "@/components/glossary/label";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import ROUTES from "@/constants/routes";
import { STATS_PERIODS, useStatsPeriod } from "@/hooks/use-period";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { RATING_COLOR_CLASS, strongholdRatingColor, strongholdWinrateColor, StrongholdPeriod, StrongholdTier, type ClanStrongholdSr, type ClanStrongholdStats, type ClanStrongholdView } from "@unicum.gg/shared";
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
        hideOnMobile && styles.hiddenFixedColumn,
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
      className={cn("py-1.5! text-right", hideOnMobile && styles.hiddenFixedColumn)}
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
// SR is an absolute rating per window, not a diff, so an SR row reads its value
// straight out of the materialized table for each column's period instead of
// subtracting two snapshots. Keyed by tier.
type SrRow = { label: string; sr: keyof ClanStrongholdSr };
type SectionRow = ProjectionRow | SrRow;

// One section per stronghold mode, mirroring the leaderboards, so each mode keeps
// its own stats together (SR, battles, win rate) under a header rather than
// scattering them.
//
// The exception is the tier-X ELO. Wargaming rates a TIER, not a mode: in
// `stronghold_info`, `stats["10"].elo` sits beside BOTH `sorties` (Skirmish) and
// `fort_battles` (Advances), so one ladder is fed by the two modes. Filed under
// either mode it contradicts that mode's own battle count, a clan that only
// plays Advances showed an ELO climbing next to `Battles 0` under "Skirmish Tier
// X", which reads as broken data and is not. So it heads the two tier-X sections
// instead of sitting inside one of them. Tiers VI and VIII keep their ELO inline:
// `fort_battles` is null there, so the tier and the mode are the same thing.
const SECTIONS: {
  title: string;
  /** The leaderboard this section heads, and the anchor the boards deep-link to.
   * Absent on the ELO band: it is a rating shared by two modes, not a board. */
  tier?: StrongholdTier;
  rows: SectionRow[];
}[] = [
  {
    title: "Tier X ELO (Advances + Skirmish)",
    rows: [
      {
        label: "ELO",
        current: (s) => eloCell(s.eloT10),
        delta: (s) => eloCell(s.eloT10, s.eloT10),
      },
    ],
  },
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
  return {
    primary: intFmt.format(v),
    className: cn("font-bold", RATING_COLOR_CLASS[strongholdRatingColor(v)]),
  };
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

  // Which of the four windows a phone shows, read once and passed down.
  const [period] = useStatsPeriod();
  const off = (p: StrongholdPeriod) => p !== period;
  const colClass = (p: StrongholdPeriod) =>
    cn(off(p) ? "max-sm:w-0!" : "max-sm:w-[44%]", "sm:w-[12%]");
  const headClass = (p: StrongholdPeriod) =>
    cn("text-right", off(p) && styles.hiddenFixedColumn);

  return (
    <Table className="my-0! table-fixed [&_td]:min-w-0 [&_tr>*+*]:border-l [&_tr>*:first-child]:pl-4! [&_tr>*]:border-border [&_th]:py-1! [&_td]:py-0.5!">
      {/* One window at a time below `sm`, the one the title's select names, so
          it takes 44% and the stat names keep the rest. */}
      <colgroup>
        <col />
        <col className={colClass(StrongholdPeriod.Overall)} />
        <col className={colClass(StrongholdPeriod.Day)} />
        <col className={colClass(StrongholdPeriod.Week)} />
        <col className={colClass(StrongholdPeriod.Month)} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Stat</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Overall)}>Total</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Day)}>Last 24h</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Week)}>Last 7d</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Month)}>Last 30d</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SECTIONS.map((section) => (
          <Fragment key={section.title}>
            {/* Anchor per tier so the stronghold boards can deep-link straight to
                a clan's row on that tier (`.../stronghold#advances`). The scroll
                margin keeps the section clear of the sticky nav. */}
            <TableRow id={section.tier} className="scroll-mt-24">

              {/* The cell owns the padding and the typography, so the title
                  lines up with the rows it heads and reads the same whether or
                  not it is a link (loading state, and the plain headers on the
                  clan-wars table). The link used to carry `px-4 py-1` on top of
                  the cell's own `pl-4`, which indented the title 32px against
                  the rows' 16px and made the band taller. */}
              <TableCell
                colSpan={5}
                className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase"
              >
                {loading || !section.tier ? (
                  section.title
                ) : (
                  // The header links to this mode's leaderboard, a contextual
                  // funnel from every indexed clan page to the stronghold boards.
                  // `inline-flex` so the caret's reserved width (opacity-0 keeps
                  // it in flow) stays inside the link instead of stretching the
                  // header across the table.
                  <Link
                    href={ROUTES.STRONGHOLD(props.region, section.tier)}
                    className="group inline-flex items-center gap-1 transition-colors hover:text-foreground"
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
                  <GlossaryLabel>{row.label}</GlossaryLabel>
                </TableCell>
                {loading ? (
                  <>
                    <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Overall)} />
                    <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Day)} />
                    <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Week)} />
                    <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Month)} />
                  </>
                ) : "sr" in row ? (
                  <>
                    {/* Not `period`: that name is the window a phone is
                        showing, and shadowing it here would compare each
                        column to itself. */}
                    {STATS_PERIODS.map((p) => (
                      <PeriodCell
                        key={p}
                        cell={srCell(props.sr[p]?.[row.sr] ?? null)}
                        hideOnMobile={off(p)}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    <PeriodCell
                      cell={row.current(props.latest)}
                      hideOnMobile={off(StrongholdPeriod.Overall)}
                    />
                    <PeriodCell
                      cell={
                        props.periods.h24 ? row.delta(props.periods.h24) : DASH
                      }
                      hideOnMobile={off(StrongholdPeriod.Day)}
                    />
                    <PeriodCell
                      cell={props.periods.d7 ? row.delta(props.periods.d7) : DASH}
                      hideOnMobile={off(StrongholdPeriod.Week)}
                    />
                    <PeriodCell
                      cell={
                        props.periods.d30 ? row.delta(props.periods.d30) : DASH
                      }
                      hideOnMobile={off(StrongholdPeriod.Month)}
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
