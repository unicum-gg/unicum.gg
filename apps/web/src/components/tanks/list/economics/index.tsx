"use client";

import { useLocale } from "@onruntime/translations/react";
import { statLabel } from "@/components/stat-label";

import { SortDirection, type SortState, SortHead } from "../sorting";
import { TablePager, usePagination } from "@/components/table-pager";
import PAGINATION from "@/constants/pagination";
import { useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankRowName } from "@/components/tanks/list/row-name";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { ColumnSelector } from "@/components/tanks/list/column-visibility";
import {
  FreeXpTierSelect,
  XpRateInput,
} from "@/components/tanks/free-xp-controls";
import { useFreeXpSettings } from "@/hooks/use-free-xp";
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
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import {
  buildEconColumns,
  useEconColumns,
  ECON_COLUMN_META,
  type EconColumn,
} from "./columns";
import { useTranslation } from "@/hooks/use-translation";

export function EconColumnSelector() {
  const { t } = useTranslation("components/tanks/list/economics/columns");
  const [selected, onToggle] = useEconColumns();
  return (
    <ColumnSelector
      items={ECON_COLUMN_META}
      selected={selected}
      onToggle={onToggle}
      label={(key) => t(`selector.${key}`)}
    />
  );
}

function sortValue(
  t: TankListItem,
  key: string,
  columns: EconColumn[],
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
      const col = columns.find((c) => c.key === key);
      return col ? col.sortValue(t) : null;
    }
  }
}

export function TanksEconTable({
  region,
  rows,
  selection,
}: {
  region: Region;
  rows: TankListItem[];
  /** When set, each row offers a comparison checkbox. */
  selection?: TankSelection;
}) {
  const { locale } = useLocale();
  const { t: tStats } = useTranslation("components/stat-labels");
  const { t: tTable } = useTranslation("components/tanks/table");
  const [sort, setSort] = useState<SortState>({
    key: "buyCredits",
    direction: SortDirection.Desc,
  });

  const { t } = useTranslation("components/tanks/list/economics/columns");
  const { t: tOwn } = useTranslation("components/tanks/list/economics/index");
  const { tier, setTier, rate, rateInput, setRate } = useFreeXpSettings();
  const [selected] = useEconColumns();
  const columns = useMemo(
    () =>
      buildEconColumns(region, tier, rate, t, locale).filter((c) => selected.has(c.key)),
    [region, selected, tier, rate, t, locale],
  );
  // The free-XP controls only matter when a free-XP column is on screen.
  const showFreeXpControls =
    selected.has("totalFreeXp") || selected.has("freeXpMoney");

  const sorted = useMemo(() => {
    const mul = sort.direction === SortDirection.Asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key, columns);
      const bv = sortValue(b, sort.key, columns);
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
  }, [rows, sort, columns]);

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
              {columns.map((c) => (
                <SortHead key={c.key} sort={sort} col={c.key} onToggle={toggleSort} align="end" tip={statLabel(c.tip, tStats)}>
                  {statLabel(c.label, tStats)}
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
                {columns.map((c) => (
                  <TableCell key={c.key} className="text-right tabular-nums">
                    {c.render(t)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePager pager={pager}>
        {showFreeXpControls && (
          <div className="flex items-center gap-2">
            <span>{tOwn("free-xp-from")}</span>
            <FreeXpTierSelect value={tier} onChange={setTier} maxTier={10} />
            <span className="ml-1">{tOwn("free-xp-at")}</span>
            <XpRateInput value={rateInput} onChange={setRate} />
            <span>{tOwn("xp-1-gold")}</span>
          </div>
        )}
      </TablePager>
    </TooltipProvider>
  );
}