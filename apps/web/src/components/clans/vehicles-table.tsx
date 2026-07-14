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
import { DEFAULT_RATING_METRIC, isRatingMetric, RATING_METRIC_LABEL, RatingMetric, type ClanVehicleRow, RATING_COLOR_CLASS, type RatingColor, winrateColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { useRegion } from "@/hooks/use-region";
import { cn } from "@/lib/utils";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pctFmt = new Intl.NumberFormat("en-US", {
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
  WinRate = "winrate",
  Rating = "rating",
}

enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

type SortState = { column: SortColumn; direction: SortDirection } | null;

// The row plus the rating for the currently-selected metric, so sorting and the
// rating column read a single resolved value.
type Row = ClanVehicleRow & { rating: number | null };

function ratingForMetric(row: ClanVehicleRow, metric: RatingMetric): number | null {
  if (metric === RatingMetric.Wn7) return row.wn7;
  if (metric === RatingMetric.Wn8) return row.wn8;
  return row.wnx;
}

function getSortValue(row: Row, column: SortColumn): number | string {
  switch (column) {
    case SortColumn.Name:
      return row.name.toLowerCase();
    case SortColumn.Type:
      return row.type ?? "";
    case SortColumn.Nation:
      return row.nation ?? "";
    case SortColumn.Tier:
      return row.tier ?? 0;
    case SortColumn.Members:
      return row.memberCount;
    case SortColumn.Battles:
      return row.battles;
    case SortColumn.AvgDamage:
      return row.avgDamage ?? -1;
    case SortColumn.AvgXp:
      return row.avgXp ?? -1;
    case SortColumn.WinRate:
      return row.winrate ?? -1;
    case SortColumn.Rating:
      return row.rating ?? -1;
  }
}

function compareRows(a: Row, b: Row, state: SortState): number {
  if (!state) return b.battles - a.battles;
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
  vehicles,
}: {
  vehicles: ClanVehicleRow[];
}) {
  const { region } = useRegion();
  const [storedRating] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;
  const [sort, setSort] = useState<SortState>({
    column: SortColumn.Battles,
    direction: SortDirection.Desc,
  });

  // Rows arrive pre-computed from the server; here we only resolve the rating
  // for the selected metric so the column and sort share one value.
  const rows = useMemo(
    () => vehicles.map((v) => ({ ...v, rating: ratingForMetric(v, metric) })),
    [vehicles, metric],
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
        No tank data for this clan yet.
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
            column={SortColumn.WinRate}
            state={sort}
            onToggle={toggleSort}
            align="end"
          >
            WR
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
          const isPremium = r.isPremium;
          return (
            <TableRow key={r.tankId}>
              <TableCell className="hidden text-center sm:table-cell">
                {r.nation ? (
                  <NationFlag nation={r.nation} region={region} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden text-center sm:table-cell">
                {r.type ? (
                  <VehicleTypeIcon type={r.type} premium={isPremium} />
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
                {r.tier ? toRoman(r.tier) : "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "font-medium max-sm:pl-4!",
                  isPremium && "text-[#FAB81B]",
                )}
              >
                {r.shortName || r.name || `#${r.tankId}`}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {intFmt.format(r.memberCount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {intFmt.format(r.battles)}
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
                  r.winrate !== null &&
                    RATING_COLOR_CLASS[winrateColor(r.winrate)],
                )}
              >
                {r.winrate !== null
                  ? `${pctFmt.format(r.winrate * 100)}%`
                  : "—"}
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
