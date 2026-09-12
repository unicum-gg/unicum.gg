"use client";

import type { NumberFormatter } from "@/lib/format";

import { useFormat } from "@/hooks/use-format";
import { Fragment } from "react";
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
import { RATING_COLOR_CLASS, RatingColor, StrongholdPeriod, type ClanGlobalMapStats, type ClanGlobalMapView } from "@unicum.gg/shared";
import { useTranslation } from "@/hooks/use-translation";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const SIGNED_INT_FORMAT = {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
} as const;
const PCT_FORMAT = {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

type Cell = { primary: string; className?: string };
const DASH: Cell = { primary: "—", className: "text-muted-foreground" };

function eloCell(num: NumberFormatter, val: number | null, delta?: number | null): Cell {
  if (val === null) return DASH;
  if (delta !== undefined) {
    return {
      primary: delta !== null ? num(SIGNED_INT_FORMAT).format(delta) : "—",
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
  return { primary: num(INT_FORMAT).format(val) };
}

function battlesCell(num: NumberFormatter, val: number | null, delta?: number | null): Cell {
  if (val === null) return DASH;
  if (delta !== undefined) return { primary: delta !== null ? num(INT_FORMAT).format(delta) : "—" };
  return { primary: num(INT_FORMAT).format(val) };
}

function provincesCell(num: NumberFormatter, val: number | null, delta?: number | null): Cell {
  if (val === null) return DASH;
  if (delta !== undefined) {
    return {
      primary: delta !== null ? num(SIGNED_INT_FORMAT).format(delta) : "—",
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
  return { primary: num(INT_FORMAT).format(val) };
}

function gwWrColor(ratio: number): RatingColor {
  if (ratio >= 0.70) return RatingColor.Excellent;
  if (ratio >= 0.60) return RatingColor.Super;
  if (ratio >= 0.55) return RatingColor.Good;
  if (ratio >= 0.50) return RatingColor.Average;
  if (ratio >= 0.45) return RatingColor.BelowAvg;
  return RatingColor.Bad;
}

function wrCell(num: NumberFormatter, wins: number | null, battles: number | null): Cell {
  if (wins === null || battles === null || battles === 0)
    return { primary: "—", className: "text-muted-foreground" };
  const ratio = wins / battles;
  return {
    primary: num(PCT_FORMAT).format(ratio),
    className: RATING_COLOR_CLASS[gwWrColor(ratio)],
  };
}

type RowDef = {
  /** Key of the row's name in the same namespace. */
  id: string;
  /** `num` is passed in rather than read from a hook: a row definition is data
   * and lives at module scope, so the reader's number formatting has to arrive
   * from the component that renders it. */
  current: (s: ClanGlobalMapStats, num: NumberFormatter) => Cell;
  delta: (s: ClanGlobalMapStats, num: NumberFormatter) => Cell;
};

// One section per Global Map front, mirroring the stronghold table: each tier
// keeps its ELO/battles/win rate together under a header, plus a "Territory"
// section for the global province count. No links (there's no Clan Wars
// leaderboard yet — that comes later).
// Ids: the wording is in `components/clans/detail/overview/clan-wars-stats`.
const SECTIONS: { id: string; rows: RowDef[] }[] = [
  {
    id: "territory",
    rows: [
      {
        id: "provinces",
        current: (s, num) => provincesCell(num, s.gmProvinces),
        delta: (s, num) => provincesCell(num, s.gmProvinces, s.gmProvinces),
      },
    ],
  },
  {
    id: "t10",
    rows: [
      {
        id: "elo",
        current: (s, num) => eloCell(num, s.gmEloT10),
        delta: (s, num) => eloCell(num, s.gmEloT10, s.gmEloT10),
      },
      {
        id: "battles",
        current: (s, num) => battlesCell(num, s.gmBattlesT10),
        delta: (s, num) => battlesCell(num, s.gmBattlesT10, s.gmBattlesT10),
      },
      {
        id: "winrate",
        current: (s, num) => wrCell(num, s.gmWinsT10, s.gmBattlesT10),
        delta: (s, num) => wrCell(num, s.gmWinsT10, s.gmBattlesT10),
      },
    ],
  },
  {
    id: "t8",
    rows: [
      {
        id: "elo",
        current: (s, num) => eloCell(num, s.gmEloT8),
        delta: (s, num) => eloCell(num, s.gmEloT8, s.gmEloT8),
      },
      {
        id: "battles",
        current: (s, num) => battlesCell(num, s.gmBattlesT8),
        delta: (s, num) => battlesCell(num, s.gmBattlesT8, s.gmBattlesT8),
      },
      {
        id: "winrate",
        current: (s, num) => wrCell(num, s.gmWinsT8, s.gmBattlesT8),
        delta: (s, num) => wrCell(num, s.gmWinsT8, s.gmBattlesT8),
      },
    ],
  },
  {
    id: "t6",
    rows: [
      {
        id: "elo",
        current: (s, num) => eloCell(num, s.gmEloT6),
        delta: (s, num) => eloCell(num, s.gmEloT6, s.gmEloT6),
      },
      {
        id: "battles",
        current: (s, num) => battlesCell(num, s.gmBattlesT6),
        delta: (s, num) => battlesCell(num, s.gmBattlesT6, s.gmBattlesT6),
      },
      {
        id: "winrate",
        current: (s, num) => wrCell(num, s.gmWinsT6, s.gmBattlesT6),
        delta: (s, num) => wrCell(num, s.gmWinsT6, s.gmBattlesT6),
      },
    ],
  },
];

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

export function ClanWarsStatsTable(
  props:
    | { loading: true }
    | { latest: ClanGlobalMapStats; periods: ClanGlobalMapView["periods"] },
) {
  const { num } = useFormat();
  const { t } = useTranslation(
    "components/clans/detail/overview/clan-wars-stats",
  );
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
          <TableHead>{t("stat")}</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Overall)}>{t("periods.total")}</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Day)}>{t("periods.day")}</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Week)}>{t("periods.week")}</TableHead>
          <TableHead className={headClass(StrongholdPeriod.Month)}>{t("periods.month")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SECTIONS.map((section) => (
          <Fragment key={section.id}>
            <TableRow>
              <TableCell
                colSpan={5}
                className="bg-muted/40 py-1! text-xs font-semibold text-muted-foreground uppercase"
              >
                {t(`sections.${section.id}`)}
              </TableCell>
            </TableRow>
            {section.rows.map((row) => (
              <TableRow key={section.id + row.id}>
                <TableCell className="py-1.5! font-medium">
                  <GlossaryLabel>{t(`rows.${row.id}`)}</GlossaryLabel>
                </TableCell>
                {loading ? (
                  <>
                    <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Overall)} />
                    <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Day)} />
                    <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Week)} />
                    <PeriodSkeleton hideOnMobile={off(StrongholdPeriod.Month)} />
                  </>
                ) : (
                  <>
                    <PeriodCell
                      cell={row.current(props.latest, num)}
                      hideOnMobile={off(StrongholdPeriod.Overall)}
                    />
                    <PeriodCell
                      cell={
                        props.periods.h24 ? row.delta(props.periods.h24, num) : DASH
                      }
                      hideOnMobile={off(StrongholdPeriod.Day)}
                    />
                    <PeriodCell
                      cell={props.periods.d7 ? row.delta(props.periods.d7, num) : DASH}
                      hideOnMobile={off(StrongholdPeriod.Week)}
                    />
                    <PeriodCell
                      cell={
                        props.periods.d30 ? row.delta(props.periods.d30, num) : DASH
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
