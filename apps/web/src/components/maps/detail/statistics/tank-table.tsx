"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toRoman } from "roman-numerals";
import {
  MIN_ROW_PERFORMANCE_SAMPLE,
  RATING_COLOR_CLASS,
  RATING_METRIC_LABEL,
  RatingMetric,
  type WnRatingMetric,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { Hint } from "@/components/hint";
import { statLabel } from "@/components/stat-label";
import { TablePager, usePagination } from "@/components/table-pager";
import { SortDirection, SortHead, type SortState } from "@/components/tanks/list/sorting";
import { TankRowName } from "@/components/tanks/list/row-name";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import PAGINATION from "@/constants/pagination";
import { useFormat } from "@/hooks/use-format";
import { useStatLabels } from "@/hooks/use-stat-labels";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { MapTankRow } from "./tank-rows";

/**
 * Every vehicle played on this map, best first.
 *
 * The catalogue's own skeleton (nation, class and tier as narrow icon columns,
 * then the name, then the figures right-aligned, cells painted in their band)
 * so a reader who has learned the tanks list reads this without learning
 * anything. Only the navbar's rating metric is drawn, as there.
 *
 * Opened on the rating HERE, which is the question the section answers: which
 * vehicles do well on this map. Ranked on a figure, a vehicle one player took
 * there once would head it on a single good battle, so vehicles with fewer than
 * `MIN_ROW_PERFORMANCE_SAMPLE` players behind them are ranked after the others,
 * each group in the order asked for, and faded with the reason on hover. The
 * column beside it is the same vehicle on every map of the mode, and the gap
 * between the two is what says the map suits it.
 */

enum Column {
  Nation = "nation",
  Type = "type",
  Tier = "tier",
  Name = "name",
  Players = "players",
  Battles = "battles",
  Damage = "damage",
  Winrate = "winrate",
  Survival = "survival",
  Rating = "rating",
  Everywhere = "everywhere",
  Gap = "gap",
}

/** Sorting on these ranks the vehicles on a result, where a thin sample would
 * otherwise win; on the others, the thin ones keep their natural place. */
const PERFORMANCE_COLUMNS = new Set<string>([
  Column.Damage,
  Column.Winrate,
  Column.Survival,
  Column.Rating,
  Column.Gap,
]);

const RATING_COLOR: Record<WnRatingMetric, (value: number) => string> = {
  [RatingMetric.Wn7]: (value) => RATING_COLOR_CLASS[wn7Color(value)],
  [RatingMetric.Wn8]: (value) => RATING_COLOR_CLASS[wn8Color(value)],
  [RatingMetric.Wnx]: (value) => RATING_COLOR_CLASS[wnxColor(value)],
};

const PCT = { style: "percent", maximumFractionDigits: 1 } as const;
const INT = { maximumFractionDigits: 0 } as const;
const INT_DELTA = { maximumFractionDigits: 0, signDisplay: "exceptZero" } as const;
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

const isThin = (row: MapTankRow) =>
  row.stats.players < MIN_ROW_PERFORMANCE_SAMPLE;

function sortValue(
  row: MapTankRow,
  key: string,
  metric: WnRatingMetric,
): number | string | null {
  const s = row.stats;
  const here = row.rating[metric];
  const everywhere = row.baselineRating[metric];
  switch (key) {
    case Column.Nation:
      return row.nation;
    case Column.Type:
      return row.type;
    case Column.Tier:
      return row.tier;
    case Column.Name:
      return (row.shortName || row.name).toLowerCase();
    case Column.Players:
      return s.players;
    case Column.Battles:
      return s.records;
    case Column.Damage:
      return s.avgDamage;
    case Column.Winrate:
      return s.winrate;
    case Column.Survival:
      return s.survival;
    case Column.Everywhere:
      return everywhere;
    case Column.Gap:
      return here == null || everywhere == null ? null : here - everywhere;
    default:
      return here;
  }
}

export function MapTankTable({
  region,
  rows,
}: {
  region: Region;
  /** Already narrowed by the filter bar above. */
  rows: MapTankRow[];
}) {
  const { num } = useFormat();
  // A vehicle has no PR or WTR, so a reader on either reads the WN fallback.
  const { wnMetric: metric } = useRatingMetric();
  const { t } = useTranslation("components/maps/detail/statistics/tank-table");
  const { t: tTable } = useTranslation("components/tanks/table");
  const { t: tStats } = useStatLabels();
  const [sort, setSort] = useState<SortState>({
    key: Column.Rating,
    direction: SortDirection.Desc,
  });

  // Memoized because `usePagination` treats a new array as a new list.
  const sorted = useMemo(() => {
    const mul = sort.direction === SortDirection.Asc ? 1 : -1;
    const byResult = PERFORMANCE_COLUMNS.has(sort.key);
    const name = (row: MapTankRow) => row.shortName || row.name;
    return [...rows].sort((a, b) => {
      if (byResult && isThin(a) !== isThin(b)) return isThin(a) ? 1 : -1;
      const av = sortValue(a, sort.key, metric);
      const bv = sortValue(b, sort.key, metric);
      // Nulls sink whichever way the column points, and the name breaks ties
      // so a re-sort does not shuffle the rows underneath the reader.
      if (av === null && bv === null) return name(a).localeCompare(name(b));
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return mul * av.localeCompare(bv) || name(a).localeCompare(name(b));
      }
      return (
        mul * ((av as number) - (bv as number)) ||
        name(a).localeCompare(name(b))
      );
    });
  }, [rows, sort, metric]);

  const { paged, pager } = usePagination(sorted, PAGINATION.SIZE.CATALOGUE);

  function toggleSort(key: string) {
    setSort((prev) =>
      prev.key === key
        ? {
            key,
            direction:
              prev.direction === SortDirection.Desc
                ? SortDirection.Asc
                : SortDirection.Desc,
          }
        : { key, direction: SortDirection.Desc },
    );
  }

  // Fading only marks a row against the others: when every row is thin, the
  // panel's own note already says so and a uniformly dimmed table says nothing.
  const mixed = rows.some((row) => !isThin(row));
  const metricLabel = RATING_METRIC_LABEL[metric];

  const value = (col: string, label: string, tip?: string) => (
    <SortHead
      key={col}
      sort={sort}
      col={col}
      onToggle={toggleSort}
      align="end"
      tip={tip}
    >
      {label}
    </SortHead>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <Table className="my-0! [&_td]:py-1.5! [&_th]:whitespace-nowrap [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-4!">
          <TableHeader>
            <TableRow>
              <SortHead
                sort={sort}
                col={Column.Nation}
                onToggle={toggleSort}
                align="center"
                tip={tTable("nation")}
                headClassName="w-[72px] min-w-[72px]"
              >
                <TankopediaHeaderIcon name="nation" />
              </SortHead>
              <SortHead
                sort={sort}
                col={Column.Type}
                onToggle={toggleSort}
                align="center"
                tip={tTable("type")}
                headClassName="w-[72px] min-w-[72px]"
              >
                <TankopediaHeaderIcon name="type" />
              </SortHead>
              <SortHead
                sort={sort}
                col={Column.Tier}
                onToggle={toggleSort}
                align="center"
                tip={tTable("tier")}
                headClassName="w-[72px] min-w-[72px]"
              >
                <span className="text-xs font-medium tracking-tight text-fd-muted-foreground">
                  I-XI
                </span>
              </SortHead>
              <SortHead
                sort={sort}
                col={Column.Name}
                onToggle={toggleSort}
                headClassName="min-w-52"
              >
                {tTable("name")}
              </SortHead>
              {value(Column.Players, statLabel("Players", tStats))}
              {value(Column.Battles, statLabel("Battles", tStats), t("battles-tip"))}
              {value(Column.Damage, statLabel("Damage", tStats))}
              {value(Column.Winrate, statLabel("Win rate", tStats))}
              {value(Column.Survival, statLabel("Survival", tStats))}
              {value(Column.Rating, metricLabel, t("rating-tip"))}
              {value(
                Column.Everywhere,
                t("everywhere", { metric: metricLabel }),
                t("everywhere-tip"),
              )}
              {value(Column.Gap, "±", t("gap-tip"))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row) => {
              const s = row.stats;
              const here = row.rating[metric];
              const everywhere = row.baselineRating[metric];
              const gap =
                here == null || everywhere == null ? null : here - everywhere;
              const thin = mixed && isThin(row);
              return (
                <TableRow
                  key={row.tankId}
                  // Only the figures fade, never the vehicle: that it was played
                  // here is a fact at any size.
                  className={cn(thin && "[&>td:nth-child(n+5)]:opacity-50")}
                >
                  <TableCell className="text-center">
                    <NationFlag nation={row.nation} region={region} />
                  </TableCell>
                  <TableCell className="text-center">
                    <VehicleTypeIcon type={row.type} premium={row.isPremium} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-center font-medium tabular-nums",
                      row.isPremium && "text-[#FAB81B]",
                    )}
                  >
                    {toRoman(row.tier)}
                  </TableCell>
                  <TableCell
                    className={cn("font-medium", row.isPremium && "text-[#FAB81B]")}
                  >
                    <TankRowName region={region} tank={row} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(INT).format(s.players)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {thin ? (
                      <Hint
                        content={t("thin-row", { count: MIN_ROW_PERFORMANCE_SAMPLE })}
                        as="span"
                      >
                        {num(INT).format(s.records)}
                      </Hint>
                    ) : (
                      num(INT).format(s.records)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.avgDamage == null ? DASH : num(INT).format(s.avgDamage)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      s.winrate != null && RATING_COLOR_CLASS[winrateColor(s.winrate)],
                    )}
                  >
                    {s.winrate == null ? DASH : num(PCT).format(s.winrate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.survival == null ? DASH : num(PCT).format(s.survival)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      here != null && RATING_COLOR[metric](here),
                    )}
                  >
                    {here == null ? DASH : num(INT).format(here)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      everywhere != null && RATING_COLOR[metric](everywhere),
                    )}
                  >
                    {everywhere == null ? DASH : num(INT).format(everywhere)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      gap == null || gap === 0
                        ? "text-fd-muted-foreground"
                        : gap > 0
                          ? "text-emerald-500"
                          : "text-red-500",
                    )}
                  >
                    {gap == null ? DASH : num(INT_DELTA).format(gap)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <TablePager pager={pager} />
    </TooltipProvider>
  );
}
