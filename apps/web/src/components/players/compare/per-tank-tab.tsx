"use client";

import { Fragment, useMemo, useState } from "react";
import {
  IntegerCell,
  RatingValueCell,
  ratingCell,
  SortDirection,
  type SortColumn,
  type SortState,
  SortToggle,
  SubHeadSort,
  TABLE_CLASSNAME,
  VehicleLabelCell,
  sameColumn,
} from "@/components/compare/per-tank-table";
import {
  computeSlotAggRating,
  computeTankRating,
} from "@/components/compare/per-tank-ratings";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RATING_METRIC_LABEL,
  RatingMetric,
} from "@unicum.gg/core/constants/rating";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import type { VehicleMeta } from "@unicum.gg/core/wargaming/wot/vehicle-meta";
import {
  buildWN8Fallback,
  type RatingColor,
  type WN8Expected,
  wn7Color,
  wn8Color,
  type WNXExpected,
  wnxColor,
} from "@unicum.gg/core/wargaming/wot/ratings";
import { bestIndex } from "@/components/compare/cells";
import { type CompareSlot } from "./comparison-table";

type SortMetric = "battles" | "rating" | "avgDmg";

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

function rowSortValue(
  row: TankRow,
  column: SortColumn<SortMetric>,
): number | null {
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
  const [sort, setSort] = useState<SortState<SortMetric>>(null);
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

  const ctx = useMemo(
    () => ({ encyclopedia, wn8Expected, wn8Fallback, wnxExpected }),
    [encyclopedia, wn8Expected, wn8Fallback, wnxExpected],
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
        row.cells[i] = {
          battles: t.all.battles,
          rating: computeTankRating(metric, t, ctx),
          avgDmg:
            t.all.battles > 0 ? t.all.damage_dealt / t.all.battles : null,
        };
        row.totalBattles += t.all.battles;
      }
    }
    return Array.from(seen.values());
  }, [slots, encyclopedia, ctx, metric]);

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

  function toggleSort(column: SortColumn<SortMetric>) {
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

  const slotAggRatings = useMemo(
    () => slots.map((s) => computeSlotAggRating(metric, s.tanks, ctx)),
    [slots, ctx, metric],
  );

  const headerWinners = useMemo(
    () =>
      bestIndex(
        slotAggRatings.map((v) => ratingCell(v, ratingColor)),
        "higher",
      ),
    [slotAggRatings, ratingColor],
  );

  if (rows.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Not enough tank data to compare.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className={TABLE_CLASSNAME}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-64 p-0">
              <SortToggle
                active={sort?.column.kind === "tier"}
                direction={sort?.column.kind === "tier" ? sort.direction : null}
                onClick={() => toggleSort({ kind: "tier" })}
                align="start"
              >
                Tank
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
            const ratingCells = r.cells.map((c) =>
              ratingCell(c.rating, ratingColor),
            );
            const bestRating = bestIndex(ratingCells, "higher");
            return (
              <TableRow key={r.tankId}>
                <VehicleLabelCell
                  tier={r.tier}
                  name={r.name}
                  type={r.type}
                  isPremium={r.isPremium}
                />
                {r.cells.map((c, i) => (
                  <Fragment key={i}>
                    <IntegerCell value={c.battles} />
                    <RatingValueCell
                      cell={ratingCells[i]}
                      isBest={bestRating.has(i)}
                      showDot={r.cells.length > 1}
                    />
                    <IntegerCell value={c.avgDmg} />
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
