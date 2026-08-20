"use client";

import {
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { SortDirection, type SortState, PAGE_SIZES, type PageSize, SortHead } from "../sorting";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import {
  buildEconColumns,
  useEconColumns,
  ECON_COLUMN_META,
  type EconColumn,
} from "./columns";

export function EconColumnSelector() {
  const [selected, onToggle] = useEconColumns();
  return (
    <ColumnSelector
      items={ECON_COLUMN_META}
      selected={selected}
      onToggle={onToggle}
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
  const [sort, setSort] = useState<SortState>({
    key: "buyCredits",
    direction: SortDirection.Desc,
  });

  const { tier, setTier, rate, rateInput, setRate } = useFreeXpSettings();
  const [selected] = useEconColumns();
  const columns = useMemo(
    () =>
      buildEconColumns(region, tier, rate).filter((c) => selected.has(c.key)),
    [region, selected, tier, rate],
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

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [viewSig, setViewSig] = useState<{
    rows: TankListItem[];
    sort: SortState;
    pageSize: PageSize;
  }>({ rows, sort, pageSize });
  if (
    viewSig.rows !== rows ||
    viewSig.sort !== sort ||
    viewSig.pageSize !== pageSize
  ) {
    setViewSig({ rows, sort, pageSize });
    setPage(1);
  }

  const total = sorted.length;
  const size = pageSize === "all" ? Math.max(total, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, totalPages);
  const startIdx = (current - 1) * size;
  const paged =
    pageSize === "all" ? sorted : sorted.slice(startIdx, startIdx + size);
  const firstShown = total === 0 ? 0 : startIdx + 1;
  const lastShown = pageSize === "all" ? total : Math.min(startIdx + size, total);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <Table className="my-0! [&_td]:py-1.5! [&_th]:whitespace-nowrap [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-4!">
          <TableHeader>
            <TableRow>
              <TankCompareHead selection={selection} />
              <SortHead sort={sort} col="nation" onToggle={toggleSort} align="center" tip="Nation" headClassName="w-[72px] min-w-[72px]">
                <TankopediaHeaderIcon name="nation" />
              </SortHead>
              <SortHead sort={sort} col="type" onToggle={toggleSort} align="center" tip="Type" headClassName="w-[72px] min-w-[72px]">
                <TankopediaHeaderIcon name="type" />
              </SortHead>
              <SortHead sort={sort} col="tier" onToggle={toggleSort} align="center" tip="Tier" headClassName="w-[72px] min-w-[72px]">
                <span className="text-xs font-medium tracking-tight text-fd-muted-foreground">
                  I-XI
                </span>
              </SortHead>
              <SortHead sort={sort} col="name" onToggle={toggleSort} headClassName="min-w-52">
                Name
              </SortHead>
              {columns.map((c) => (
                <SortHead key={c.key} sort={sort} col={c.key} onToggle={toggleSort} align="end" tip={c.tip}>
                  {c.label}
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
                  <Link
                    href={ROUTES.TANK(region, t.slug)}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <TankIcon
                      region={region}
                      tag={t.tag}
                      type={t.type}
                      className="h-3.5 w-auto shrink-0 object-contain"
                    />
                    <span className="min-w-0 truncate">
                      {t.shortName || t.name}
                    </span>
                  </Link>
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border px-4 py-3 text-xs text-fd-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger className="h-7 w-18.5" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showFreeXpControls && (
            <div className="flex items-center gap-2">
              <span>Free XP from</span>
              <FreeXpTierSelect value={tier} onChange={setTier} maxTier={10} />
              <span className="ml-1">at</span>
              <XpRateInput value={rateInput} onChange={setRate} />
              <span>XP = 1 gold</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular-nums">
            {firstShown}–{lastShown} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current <= 1}
              aria-label="Previous page"
              className="cursor-pointer rounded-md border border-fd-border p-1 transition-colors hover:bg-fd-secondary/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <CaretLeftIcon weight="bold" className="size-3.5" />
            </button>
            <span className="min-w-16 text-center tabular-nums">
              Page {current} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= totalPages}
              aria-label="Next page"
              className="cursor-pointer rounded-md border border-fd-border p-1 transition-colors hover:bg-fd-secondary/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <CaretRightIcon weight="bold" className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}