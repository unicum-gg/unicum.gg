"use client";

import {
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { SortDirection, type SortState, PAGE_SIZES, type PageSize, SortHead } from "../sorting";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { portalIconUrl, type Region } from "@unicum.gg/wargaming";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  ColumnSelector,
  useColumnVisibility,
} from "@/components/tanks/list/column-visibility";
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
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";


const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

type MasteryColumn = {
  key: string;
  label: string;
  iconFile: string;
  tip: string;
  value: (t: TankListItem) => number | null;
};

// Badge icons served from WG's portal CDN under the version-less `latest`
// alias (the same art the account profile pages use). The mastery badge art is
// server-agnostic, so the URL is region-hosted only for consistency; the file
// is built at render via `portalIconUrl(region, ...)`.

// From least to most demanding badge. Values are the single-battle XP each
// badge requires on that vehicle, mirrored per region (see the mastery cron).
const MASTERY_COLUMNS: MasteryColumn[] = [
  {
    key: "class3",
    label: "3rd Class",
    iconFile: "rank_03.png",
    tip: "3rd Class: XP needed to beat 50% of players",
    value: (t) => t.mastery?.class3 ?? null,
  },
  {
    key: "class2",
    label: "2nd Class",
    iconFile: "rank_02.png",
    tip: "2nd Class: XP needed to beat 80% of players",
    value: (t) => t.mastery?.class2 ?? null,
  },
  {
    key: "class1",
    label: "1st Class",
    iconFile: "rank_01.png",
    tip: "1st Class: XP needed to beat 95% of players",
    value: (t) => t.mastery?.class1 ?? null,
  },
  {
    key: "ace",
    label: "Ace Tanker",
    iconFile: "rank_m.png",
    tip: "Ace Tanker: XP needed to beat 99% of players",
    value: (t) => t.mastery?.ace ?? null,
  },
];

const MASTERY_KEYS = MASTERY_COLUMNS.map((c) => c.key);
const MASTERY_COOKIE = "unicum.mom_columns";

function useMasteryColumns() {
  return useColumnVisibility(MASTERY_COOKIE, MASTERY_KEYS, MASTERY_KEYS);
}

export function MasteryColumnSelector() {
  const [selected, onToggle] = useMasteryColumns();
  return (
    <ColumnSelector
      items={MASTERY_COLUMNS}
      selected={selected}
      onToggle={onToggle}
    />
  );
}

function sortValue(
  t: TankListItem,
  key: string,
  columns: MasteryColumn[],
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
      return col ? col.value(t) : null;
    }
  }
}

export function TanksMasteryTable({
  region,
  rows,
}: {
  region: Region;
  rows: TankListItem[];
}) {
  const [sort, setSort] = useState<SortState>({
    key: "ace",
    direction: SortDirection.Desc,
  });

  const [selected] = useMasteryColumns();
  const columns = useMemo(
    () => MASTERY_COLUMNS.filter((c) => selected.has(c.key)),
    [selected],
  );

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
                  <Image
                    src={portalIconUrl(region, c.iconFile)}
                    alt={c.label}
                    width={20}
                    height={20}
                    className="h-5 w-auto object-contain"
                    unoptimized
                  />
                </SortHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((t) => (
              <TableRow key={t.tankId}>
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
                {columns.map((c) => {
                  const v = c.value(t);
                  return (
                    <TableCell key={c.key} className="text-right tabular-nums">
                      {v != null ? intFmt.format(v) : DASH}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border px-4 py-3 text-xs text-fd-muted-foreground">
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