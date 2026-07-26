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
import { ClanTag } from "@/components/entity/clan-tag";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_RATING_METRIC, isRatingMetric, RATING_METRIC_LABEL, RatingMetric, type VehicleMeta, type RatingColor, type WN8Expected, wn7Color, wn8Color, type WNXExpected, wnxColor } from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import type { ClanTankAggregate } from "@unicum.gg/core/clans/repository/tanks";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import { bestIndex } from "@/components/compare/cells";
import {
  type ClanCompareSlot,
  clanAggregatesToTankStats,
} from "./comparison-table";

type SortMetric = "battles" | "members" | "rating" | "avgDmg";

type SlotCell = {
  battles: number;
  memberCount: number;
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
  if (column.metric === "members")
    return c.memberCount > 0 ? c.memberCount : null;
  if (column.metric === "rating") return c.rating;
  return c.avgDmg;
}

function aggToTankStats(a: ClanTankAggregate): TankStats {
  return {
    tank_id: a.tankId,
    mark_of_mastery: null,
    all: {
      battles: a.battles,
      wins: a.wins,
      damage_dealt: a.damageDealt,
      spotted: a.spotted,
      frags: a.frags,
      dropped_capture_points: a.droppedCapturePoints,
      radio_assisted_damage: a.radioAssistedDamage,
      track_assisted_damage: a.trackAssistedDamage,
      xp: a.xp,
    },
  };
}

export function PerTankTab({
  slots,
  encyclopedia,
  wn8Expected,
  wnxExpected,
  wn8Fallback,
}: {
  slots: ClanCompareSlot[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
  wn8Fallback: Map<string, WN8Expected>;
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
      for (const agg of slots[i].tankAggregates) {
        if (agg.battles <= 0) continue;
        let row = seen.get(agg.tankId);
        if (!row) {
          const meta = encyclopedia[String(agg.tankId)];
          row = {
            tankId: agg.tankId,
            name: meta?.shortName || meta?.name || `#${agg.tankId}`,
            tier: meta?.tier ?? 0,
            type: meta?.type ?? null,
            isPremium: meta?.isPremium ?? false,
            totalBattles: 0,
            cells: slots.map(() => ({
              battles: 0,
              memberCount: 0,
              rating: null,
              avgDmg: null,
            })),
          };
          seen.set(agg.tankId, row);
        }
        row.cells[i] = {
          battles: agg.battles,
          memberCount: agg.memberCount,
          rating: computeTankRating(metric, aggToTankStats(agg), ctx),
          avgDmg: agg.battles > 0 ? agg.damageDealt / agg.battles : null,
        };
        row.totalBattles += agg.battles;
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
    () =>
      slots.map((s) =>
        computeSlotAggRating(
          metric,
          clanAggregatesToTankStats(s.tankAggregates),
          ctx,
        ),
      ),
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
                colSpan={4}
                className="text-center"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <ClanTag
                    tag={s.clan?.tag ?? s.requested}
                    color={s.clan?.color ?? null}
                    className="font-mono"
                  />
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
                  column={{ kind: "slot", slot: idx, metric: "members" }}
                  onClick={toggleSort}
                  label="Members"
                />
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
                    <IntegerCell value={c.memberCount} />
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
