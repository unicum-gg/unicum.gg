"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { Fragment, useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RATING_METRIC_LABEL,
  RatingMetric,
} from "@/constants/rating";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { cn } from "@/lib/utils";
import type { VehicleMeta } from "@/services/wargaming/wot/encyclopedia";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  RATING_COLOR_CLASS,
  type RatingColor,
  type WN8Expected,
  wn7Color,
  wn8Color,
  type WNXExpected,
  wnxColor,
} from "@/services/wargaming/wot/ratings";
import {
  bestIndex,
  type CompareSlot,
  intFmt,
  type MetricCell,
  ratingCell,
} from "./comparison-table";

type SlotCell = {
  battles: number;
  rating: number | null;
  avgDmg: number | null;
};

type TankRow = {
  tankId: number;
  name: string;
  tier: number;
  type: string | null;
  isPremium: boolean;
  totalBattles: number;
  cells: SlotCell[];
};

type SortMetric = "battles" | "rating" | "avgDmg";
type SortColumn = { kind: "tier" } | { kind: "slot"; slot: number; metric: SortMetric };
enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}
type SortState = { column: SortColumn; direction: SortDirection } | null;

function sameColumn(a: SortColumn, b: SortColumn): boolean {
  if (a.kind === "tier" && b.kind === "tier") return true;
  if (a.kind === "slot" && b.kind === "slot") {
    return a.slot === b.slot && a.metric === b.metric;
  }
  return false;
}

function rowSortValue(row: TankRow, column: SortColumn): number | null {
  if (column.kind === "tier") return row.tier;
  const c = row.cells[column.slot];
  if (!c) return null;
  if (column.metric === "battles") return c.battles > 0 ? c.battles : null;
  if (column.metric === "rating") return c.rating;
  return c.avgDmg;
}

export function PerTankTab({
  slots,
  encyclopedia,
  wn8Expected,
  wnxExpected,
}: {
  slots: CompareSlot[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
}) {
  const [sort, setSort] = useState<SortState>(null);
  const [storedRating] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;
  const metricLabel = RATING_METRIC_LABEL[metric];

  const wn8Fallback = useMemo(
    () => buildWN8Fallback(wn8Expected, encyclopedia),
    [wn8Expected, encyclopedia],
  );

  const ratingColor: (v: number) => RatingColor =
    metric === RatingMetric.Wn7
      ? wn7Color
      : metric === RatingMetric.Wn8
        ? wn8Color
        : wnxColor;

  const rows: TankRow[] = useMemo(() => {
    const seen = new Map<number, TankRow>();
    for (let i = 0; i < slots.length; i++) {
      for (const t of slots[i].tanks) {
        if (t.all.battles <= 0) continue;
        let row = seen.get(t.tank_id);
        if (!row) {
          const meta = encyclopedia[String(t.tank_id)];
          row = {
            tankId: t.tank_id,
            name: meta?.shortName || meta?.name || `#${t.tank_id}`,
            tier: meta?.tier ?? 0,
            type: meta?.type ?? null,
            isPremium: meta?.isPremium ?? false,
            totalBattles: 0,
            cells: slots.map(() => ({
              battles: 0,
              rating: null,
              avgDmg: null,
            })),
          };
          seen.set(t.tank_id, row);
        }
        const meta = encyclopedia[String(t.tank_id)];
        let rating: number | null = null;
        if (metric === RatingMetric.Wn7) {
          rating = computeWN7(
            {
              battles: t.all.battles,
              wins: t.all.wins,
              frags: t.all.frags,
              damageDealt: t.all.damage_dealt,
              spotted: t.all.spotted,
              droppedCapturePoints: t.all.dropped_capture_points,
            },
            meta?.tier ?? null,
          );
        } else if (metric === RatingMetric.Wn8) {
          rating = computeWN8([t], wn8Expected, encyclopedia, wn8Fallback);
        } else {
          rating = computeWNX([t], wnxExpected);
        }
        const avgDmg =
          t.all.battles > 0 ? t.all.damage_dealt / t.all.battles : null;
        row.cells[i] = { battles: t.all.battles, rating, avgDmg };
        row.totalBattles += t.all.battles;
      }
    }
    return Array.from(seen.values());
  }, [slots, encyclopedia, wn8Expected, wn8Fallback, wnxExpected, metric]);

  const sortedRows = useMemo(() => {
    if (!sort) {
      return [...rows].sort((a, b) => b.totalBattles - a.totalBattles);
    }
    const mul = sort.direction === SortDirection.Asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = rowSortValue(a, sort.column);
      const bv = rowSortValue(b, sort.column);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return mul * (av - bv);
    });
  }, [rows, sort]);

  function toggleSort(column: SortColumn) {
    setSort((prev) => {
      if (!prev || !sameColumn(prev.column, column)) {
        return { column, direction: SortDirection.Desc };
      }
      if (prev.direction === SortDirection.Desc) {
        return { column, direction: SortDirection.Asc };
      }
      return null;
    });
  }

  const slotAggRatings: (number | null)[] = useMemo(() => {
    return slots.map((s) => {
      if (s.tanks.length === 0) return null;
      if (metric === RatingMetric.Wn7) {
        let battles = 0,
          wins = 0,
          frags = 0,
          damageDealt = 0,
          spotted = 0,
          droppedCapturePoints = 0;
        for (const t of s.tanks) {
          battles += t.all.battles;
          wins += t.all.wins;
          frags += t.all.frags;
          damageDealt += t.all.damage_dealt;
          spotted += t.all.spotted;
          droppedCapturePoints += t.all.dropped_capture_points;
        }
        if (battles === 0) return null;
        let weighted = 0;
        let totalBattles = 0;
        for (const t of s.tanks) {
          const meta = encyclopedia[String(t.tank_id)];
          if (!meta) continue;
          weighted += meta.tier * t.all.battles;
          totalBattles += t.all.battles;
        }
        const avgTier = totalBattles > 0 ? weighted / totalBattles : null;
        return computeWN7(
          { battles, wins, frags, damageDealt, spotted, droppedCapturePoints },
          avgTier,
        );
      }
      if (metric === RatingMetric.Wn8) {
        return computeWN8(s.tanks, wn8Expected, encyclopedia, wn8Fallback);
      }
      return computeWNX(s.tanks, wnxExpected);
    });
  }, [slots, encyclopedia, wn8Expected, wn8Fallback, wnxExpected, metric]);

  const headerWinners = useMemo(() => {
    const cells = slotAggRatings.map((v) => ratingCell(v, ratingColor));
    return bestIndex(cells, "higher");
  }, [slotAggRatings, ratingColor]);

  if (rows.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Not enough tank data to compare.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="my-0! table-fixed [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_thead_th:first-child]:pl-4! [&_tbody_tr]:border-b [&_tbody_tr]:border-fd-border [&_thead_tr]:border-b [&_thead_tr]:border-fd-border [&_td]:border-r [&_th]:border-r [&_td]:border-fd-border [&_th]:border-fd-border [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
        <TableHeader>
          <TableRow>
            <TableHead className="w-64 p-0">
              <SortToggle
                active={sort?.column.kind === "tier"}
                direction={sort?.column.kind === "tier" ? sort.direction : null}
                onClick={() => toggleSort({ kind: "tier" })}
                align="start"
              >
                Vehicle
              </SortToggle>
            </TableHead>
            {slots.map((s, idx) => (
              <TableHead
                key={`${s.requested}-${idx}`}
                colSpan={3}
                className="text-center"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  {s.player?.nickname ?? s.requested}
                  {headerWinners.has(idx) && (
                    <span
                      aria-hidden
                      className="inline-block size-1.5 rounded-full bg-fd-primary"
                    />
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            <TableHead className="text-xs text-muted-foreground">Tier</TableHead>
            {slots.map((_, idx) => (
              <Fragment key={idx}>
                <SubHeadSort
                  sort={sort}
                  column={{ kind: "slot", slot: idx, metric: "battles" }}
                  onClick={toggleSort}
                  label="Battles"
                />
                <SubHeadSort
                  sort={sort}
                  column={{ kind: "slot", slot: idx, metric: "rating" }}
                  onClick={toggleSort}
                  label={metricLabel}
                />
                <SubHeadSort
                  sort={sort}
                  column={{ kind: "slot", slot: idx, metric: "avgDmg" }}
                  onClick={toggleSort}
                  label="Dmg"
                />
              </Fragment>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((r) => {
            const ratingCells: MetricCell[] = r.cells.map((c) =>
              ratingCell(c.rating, ratingColor),
            );
            const bestRating = bestIndex(ratingCells, "higher");
            return (
              <TableRow key={r.tankId}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {r.type && (
                      <VehicleTypeIcon
                        type={r.type}
                        premium={r.isPremium}
                      />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {r.tier > 0 ? toRoman(r.tier) : "—"}
                    </span>
                    <span
                      className={cn(
                        "font-medium truncate",
                        r.isPremium && "text-[#FAB81B]",
                      )}
                    >
                      {r.name}
                    </span>
                  </span>
                </TableCell>
                {r.cells.map((c, i) => (
                  <Fragment key={i}>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        c.battles === 0 && "text-muted-foreground",
                      )}
                    >
                      {c.battles > 0 ? intFmt.format(c.battles) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        ratingCells[i].color
                          ? RATING_COLOR_CLASS[ratingCells[i].color]
                          : "text-muted-foreground",
                      )}
                    >
                      {ratingCells[i].display}
                      {bestRating.has(i) && r.cells.length > 1 && (
                        <span
                          aria-hidden
                          className="ms-1.5 inline-block size-1.5 rounded-full bg-fd-primary align-middle"
                        />
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        c.avgDmg === null && "text-muted-foreground",
                      )}
                    >
                      {c.avgDmg !== null ? intFmt.format(c.avgDmg) : "—"}
                    </TableCell>
                  </Fragment>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SortToggle({
  active,
  direction,
  onClick,
  align,
  children,
}: {
  active: boolean;
  direction: SortDirection | null;
  onClick: () => void;
  align: "start" | "end";
  children: React.ReactNode;
}) {
  const Icon =
    active && direction === SortDirection.Asc
      ? CaretUpIcon
      : active && direction === SortDirection.Desc
        ? CaretDownIcon
        : CaretUpDownIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left font-medium select-none hover:text-foreground",
        align === "end" && "justify-end text-right",
        active ? "text-foreground" : "",
      )}
    >
      {children}
      <Icon
        weight="bold"
        className={cn("size-3.5", active ? "opacity-100" : "opacity-40")}
      />
    </button>
  );
}

function SubHeadSort({
  sort,
  column,
  onClick,
  label,
}: {
  sort: SortState;
  column: SortColumn;
  onClick: (col: SortColumn) => void;
  label: string;
}) {
  const active = !!sort && sameColumn(sort.column, column);
  return (
    <TableHead className="p-0">
      <SortToggle
        active={active}
        direction={active ? sort!.direction : null}
        onClick={() => onClick(column)}
        align="end"
      >
        <span className="text-xs text-muted-foreground">{label}</span>
      </SortToggle>
    </TableHead>
  );
}
