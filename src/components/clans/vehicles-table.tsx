"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/players/nation-flag";
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
import type { ClanTankAggregate } from "@/services/clans/repository/tanks";
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
import type { TankStats } from "@/services/wargaming/wot/tanks";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

enum SortColumn {
  Name = "name",
  Type = "type",
  Nation = "nation",
  Tier = "tier",
  Members = "members",
  Battles = "battles",
  AvgDamage = "avg_damage",
  AvgXp = "avg_xp",
  Rating = "rating",
}

enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

type SortState = { column: SortColumn; direction: SortDirection } | null;

type Row = {
  agg: ClanTankAggregate;
  meta: VehicleMeta | null;
  avgDamage: number | null;
  avgXp: number | null;
  rating: number | null;
};

function buildRows(
  aggregates: ClanTankAggregate[],
  encyclopedia: Record<string, VehicleMeta>,
  metric: RatingMetric,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): Row[] {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  return aggregates.map((agg) => {
    const meta = encyclopedia[String(agg.tankId)] ?? null;
    const avgDamage = agg.battles > 0 ? agg.damageDealt / agg.battles : null;
    const avgXp =
      agg.battles > 0 && agg.xp > 0 ? agg.xp / agg.battles : null;
    let rating: number | null = null;
    if (agg.battles > 0) {
      if (metric === RatingMetric.Wn7) {
        rating = computeWN7(
          {
            battles: agg.battles,
            wins: agg.wins,
            frags: agg.frags,
            damageDealt: agg.damageDealt,
            spotted: agg.spotted,
            droppedCapturePoints: agg.droppedCapturePoints,
          },
          meta?.tier ?? null,
        );
      } else if (metric === RatingMetric.Wn8) {
        const synthetic: TankStats = {
          tank_id: agg.tankId,
          mark_of_mastery: null,
          all: {
            battles: agg.battles,
            wins: agg.wins,
            damage_dealt: agg.damageDealt,
            spotted: agg.spotted,
            frags: agg.frags,
            dropped_capture_points: agg.droppedCapturePoints,
            radio_assisted_damage: agg.radioAssistedDamage,
            track_assisted_damage: agg.trackAssistedDamage,
            xp: agg.xp,
          },
        };
        rating = computeWN8([synthetic], wn8Expected, encyclopedia, wn8Fallback);
      } else {
        const synthetic: TankStats = {
          tank_id: agg.tankId,
          mark_of_mastery: null,
          all: {
            battles: agg.battles,
            wins: agg.wins,
            damage_dealt: agg.damageDealt,
            spotted: agg.spotted,
            frags: agg.frags,
            dropped_capture_points: agg.droppedCapturePoints,
            radio_assisted_damage: agg.radioAssistedDamage,
            track_assisted_damage: agg.trackAssistedDamage,
            xp: agg.xp,
          },
        };
        rating = computeWNX([synthetic], wnxExpected);
      }
    }
    return { agg, meta, avgDamage, avgXp, rating };
  });
}

function getSortValue(row: Row, column: SortColumn): number | string {
  switch (column) {
    case SortColumn.Name:
      return row.meta?.name?.toLowerCase() ?? "";
    case SortColumn.Type:
      return row.meta?.type ?? "";
    case SortColumn.Nation:
      return row.meta?.nation ?? "";
    case SortColumn.Tier:
      return row.meta?.tier ?? 0;
    case SortColumn.Members:
      return row.agg.memberCount;
    case SortColumn.Battles:
      return row.agg.battles;
    case SortColumn.AvgDamage:
      return row.avgDamage ?? -1;
    case SortColumn.AvgXp:
      return row.avgXp ?? -1;
    case SortColumn.Rating:
      return row.rating ?? -1;
  }
}

function compareRows(a: Row, b: Row, state: SortState): number {
  if (!state) return b.agg.battles - a.agg.battles;
  const mul = state.direction === SortDirection.Asc ? 1 : -1;
  const av = getSortValue(a, state.column);
  const bv = getSortValue(b, state.column);
  if (typeof av === "string" && typeof bv === "string") {
    return mul * av.localeCompare(bv);
  }
  return mul * ((av as number) - (bv as number));
}

function SortableHead({
  column,
  state,
  onToggle,
  align = "start",
  hideOnMobile,
  headClassName,
  children,
}: {
  column: SortColumn;
  state: SortState;
  onToggle: (col: SortColumn) => void;
  align?: "start" | "center" | "end";
  hideOnMobile?: boolean;
  headClassName?: string;
  children: React.ReactNode;
}) {
  const active = state?.column === column;
  const Icon = active
    ? state.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  return (
    <TableHead
      className={cn(
        "p-0",
        hideOnMobile && "hidden sm:table-cell",
        headClassName,
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(column)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left font-medium select-none hover:text-foreground",
          align === "center" && "justify-center",
          align === "end" && "justify-end",
          active ? "text-foreground" : "",
        )}
      >
        {children}
        <Icon
          weight="bold"
          className={cn("size-3.5", active ? "opacity-100" : "opacity-40")}
        />
      </button>
    </TableHead>
  );
}

export function ClanVehiclesTable({
  aggregates,
  encyclopedia,
  wn8Expected,
  wnxExpected,
}: {
  aggregates: ClanTankAggregate[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
}) {
  const [storedRating] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;
  const [sort, setSort] = useState<SortState>(null);

  const rows = useMemo(
    () => buildRows(aggregates, encyclopedia, metric, wn8Expected, wnxExpected),
    [aggregates, encyclopedia, metric, wn8Expected, wnxExpected],
  );
  const sorted = useMemo(
    () => [...rows].sort((a, b) => compareRows(a, b, sort)),
    [rows, sort],
  );

  function toggleSort(column: SortColumn) {
    setSort((prev) => {
      if (prev?.column !== column) {
        return { column, direction: SortDirection.Desc };
      }
      if (prev.direction === SortDirection.Desc) {
        return { column, direction: SortDirection.Asc };
      }
      return null;
    });
  }

  if (rows.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No vehicle data for this clan yet.
      </p>
    );
  }

  const ratingColor: (v: number) => RatingColor =
    metric === RatingMetric.Wn7
      ? wn7Color
      : metric === RatingMetric.Wn8
        ? wn8Color
        : wnxColor;
  const metricLabel = RATING_METRIC_LABEL[metric];

  return (
    <Table className="my-0! [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-3! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-3!">
      <TableHeader>
        <TableRow>
          <SortableHead
            column={SortColumn.Nation}
            state={sort}
            onToggle={toggleSort}
            align="center"
            hideOnMobile
            headClassName="w-px"
          >
            Nation
          </SortableHead>
          <SortableHead
            column={SortColumn.Type}
            state={sort}
            onToggle={toggleSort}
            align="center"
            hideOnMobile
            headClassName="w-px"
          >
            Type
          </SortableHead>
          <SortableHead
            column={SortColumn.Tier}
            state={sort}
            onToggle={toggleSort}
            align="center"
            hideOnMobile
            headClassName="w-px"
          >
            Tier
          </SortableHead>
          <SortableHead
            column={SortColumn.Name}
            state={sort}
            onToggle={toggleSort}
          >
            Name
          </SortableHead>
          <SortableHead
            column={SortColumn.Members}
            state={sort}
            onToggle={toggleSort}
            align="end"
          >
            Members
          </SortableHead>
          <SortableHead
            column={SortColumn.Battles}
            state={sort}
            onToggle={toggleSort}
            align="end"
          >
            Battles
          </SortableHead>
          <SortableHead
            column={SortColumn.AvgDamage}
            state={sort}
            onToggle={toggleSort}
            align="end"
          >
            Avg damage
          </SortableHead>
          <SortableHead
            column={SortColumn.AvgXp}
            state={sort}
            onToggle={toggleSort}
            align="end"
            hideOnMobile
          >
            Avg XP
          </SortableHead>
          <SortableHead
            column={SortColumn.Rating}
            state={sort}
            onToggle={toggleSort}
            align="end"
          >
            {metricLabel}
          </SortableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => {
          const isPremium = r.meta?.isPremium ?? false;
          return (
            <TableRow key={r.agg.tankId}>
              <TableCell className="hidden text-center sm:table-cell">
                {r.meta?.nation ? (
                  <NationFlag nation={r.meta.nation} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden text-center sm:table-cell">
                {r.meta?.type ? (
                  <VehicleTypeIcon
                    type={r.meta.type}
                    premium={isPremium}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell
                className={cn(
                  "hidden text-center font-medium sm:table-cell",
                  isPremium && "text-[#FAB81B]",
                )}
              >
                {r.meta?.tier ? toRoman(r.meta.tier) : "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "font-medium max-sm:pl-4!",
                  isPremium && "text-[#FAB81B]",
                )}
              >
                {r.meta?.shortName || r.meta?.name || `#${r.agg.tankId}`}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {intFmt.format(r.agg.memberCount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {intFmt.format(r.agg.battles)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.avgDamage !== null ? intFmt.format(r.avgDamage) : "—"}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {r.avgXp !== null ? intFmt.format(r.avgXp) : "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  r.rating !== null && RATING_COLOR_CLASS[ratingColor(r.rating)],
                )}
              >
                {r.rating !== null ? decFmt.format(r.rating) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
