"use client";

import { useFormat } from "@/hooks/use-format";
import { SortDirection, type SortState, SortHead } from "../sorting";
import { TablePager, usePagination } from "@/components/table-pager";
import PAGINATION from "@/constants/pagination";
import { useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankRowName } from "@/components/tanks/list/row-name";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  PERF_COLUMN_BY_KEY,
  PERF_COLUMNS,
  perfColumnLabel,
  type PerfColumn,
  usePerfColumns,
} from "@/components/tanks/perf-columns";
import type { TankListItem } from "@/components/tanks/list";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  TankCompareCell,
  TankCompareHead,
} from "@/components/tanks/list/compare-cell";
import type { TankSelection } from "@/hooks/use-compare-selection";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RatingMetric,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";


function sortValue(
  t: TankListItem,
  key: string,
  metric: RatingMetric,
): number | string | null {
  switch (key) {
    case "tier":
      return t.tier;
    case "name":
      return (t.shortName || t.name).toLowerCase();
    case "nation":
      return t.nation;
    case "type":
      return t.type;
    default: {
      const col = PERF_COLUMN_BY_KEY[key];
      return col ? col.sortValue(t.stats, metric) : null;
    }
  }
}

export function TanksTable({
  region,
  rows,
  selection,
}: {
  region: Region;
  rows: TankListItem[];
  /** When set, each row offers a comparison checkbox. */
  selection?: TankSelection;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/tanks/perf-columns");
  const { t: tTable } = useTranslation("components/tanks/table");
  const [storedRating] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const metric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;

  const [selected] = usePerfColumns();
  const visible: PerfColumn[] = useMemo(
    () => PERF_COLUMNS.filter((c) => selected.has(c.key)),
    [selected],
  );

  const [sort, setSort] = useState<SortState>({
    key: "battles",
    direction: SortDirection.Desc,
  });

  const sorted = useMemo(() => {
    const mul = sort.direction === SortDirection.Asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key, metric);
      const bv = sortValue(b, sort.key, metric);
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return mul * av.localeCompare(bv) || a.name.localeCompare(b.name);
      }
      return (
        mul * ((av as number) - (bv as number)) || a.name.localeCompare(b.name)
      );
    });
  }, [rows, sort, metric]);

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

  // The site's own pager, like every other table: it owns the page and the
  // row count, keeps them in `?page=`/`?ps=` and resets when the rows under
  // the reader change. Five copies of this block were kept by hand here, down
  // to a row count written in English in the markup.
  const { paged, pager } = usePagination(sorted, PAGINATION.SIZE.CATALOGUE);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <Table className="my-0! [&_td]:py-1.5! [&_th]:whitespace-nowrap [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-4!">
          <TableHeader>
            <TableRow>
              <TankCompareHead selection={selection} />
              <SortHead sort={sort} col="nation" onToggle={toggleSort} align="center" tip={tTable("nation")} headClassName="w-[72px] min-w-[72px]">
                <TankopediaHeaderIcon name="nation" />
              </SortHead>
              <SortHead sort={sort} col="type" onToggle={toggleSort} align="center" tip={tTable("type")} headClassName="w-[72px] min-w-[72px]">
                <TankopediaHeaderIcon name="type" />
              </SortHead>
              <SortHead sort={sort} col="tier" onToggle={toggleSort} align="center" tip={tTable("tier")} headClassName="w-[72px] min-w-[72px]">
                <span className="text-xs font-medium tracking-tight text-fd-muted-foreground">
                  I-XI
                </span>
              </SortHead>
              <SortHead sort={sort} col="name" onToggle={toggleSort} headClassName="min-w-52">
                {tTable("name")}
              </SortHead>
              {visible.map((c) => (
                <SortHead
                  key={c.key}
                  sort={sort}
                  col={c.key}
                  onToggle={toggleSort}
                  align="end"
                  tip={c.tipped ? t(`columns.${c.key}.tip`) : undefined}
                >
                  {perfColumnLabel(c, metric, t)}
                </SortHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((t) => (
              <TableRow key={t.tankId}>
                <TankCompareCell
                  selection={selection}
                  slug={t.slug}
                  name={t.shortName || t.name}
                />
                <TableCell className="text-center">
                  <NationFlag nation={t.nation} region={region} />
                </TableCell>
                <TableCell className="text-center">
                  <VehicleTypeIcon type={t.type} premium={t.isPremium} />
                </TableCell>
                <TableCell
                  className={cn(
                    "text-center font-medium tabular-nums",
                    t.isPremium && "text-[#FAB81B]",
                  )}
                >
                  {toRoman(t.tier)}
                </TableCell>
                <TableCell
                  className={cn("font-medium", t.isPremium && "text-[#FAB81B]")}
                >
                  <TankRowName region={region} tank={t} />
                </TableCell>
                {visible.map((c) => {
                  const { node, className } = c.cell(t.stats, metric, num);
                  return (
                    <TableCell
                      key={c.key}
                      className={cn("text-right tabular-nums", className)}
                    >
                      {node}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePager pager={pager} />
    </TooltipProvider>
  );
}