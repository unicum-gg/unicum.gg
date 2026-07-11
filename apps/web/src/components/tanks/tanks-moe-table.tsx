"use client";

import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/players/nation-flag";
import { TankIcon } from "@/components/players/tank-icon";
import { TankopediaHeaderIcon } from "@/components/players/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import type { TankListItem } from "@/components/tanks/tanks-index";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming/region";

enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}
type SortState = { key: string; direction: SortDirection };
const PAGE_SIZES = [25, 50, 100, 200] as const;
type PageSize = number | "all";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

type MoeColumn = {
  key: string;
  label: string;
  marks: 1 | 2 | 3;
  tip: string;
  value: (t: TankListItem) => number | null;
};

// The three marks map to WG's 65/85/95th combined-damage percentiles. The mark
// glyph is drawn as 1/2/3 tally bars (see MarkIcon); the exact percentile lives
// in the tooltip.
const MOE_COLUMNS: MoeColumn[] = [
  {
    key: "mark1",
    label: "1 Mark",
    marks: 1,
    tip: "1 Mark: your rolling average combined damage (last ~100 battles) must beat 65% of players on this tank over the last 14 days",
    value: (t) => t.moe?.mark1 ?? null,
  },
  {
    key: "mark2",
    label: "2 Marks",
    marks: 2,
    tip: "2 Marks: your rolling average combined damage (last ~100 battles) must beat 85% of players on this tank over the last 14 days",
    value: (t) => t.moe?.mark2 ?? null,
  },
  {
    key: "mark3",
    label: "3 Marks",
    marks: 3,
    tip: "3 Marks: your rolling average combined damage (last ~100 battles) must beat 95% of players on this tank over the last 14 days",
    value: (t) => t.moe?.mark3 ?? null,
  },
];

// The Marks of Excellence glyph is a row of slanted tally bars (WG's own
// `ico-stats__marks` SVG, transcribed so we do not couple to its versioned CDN
// chunk). Each subpath is one bar, drawn left to right, so N marks = the first N
// bars. Uses currentColor, so it tracks the sort header's active/hover state.
const MARK_BARS = [
  "M3.765 0h2.824L2.823 12H0L3.765 0z",
  "m4.706 0h2.824L7.529 12H4.706L8.471 0z",
  "m4.706 0H16l-3.765 12H9.412l3.764-12h.001z",
];
const MARK_VIEW_WIDTH = { 1: 6.6, 2: 11.3, 3: 16 } as const;

function MarkIcon({ marks, label }: { marks: 1 | 2 | 3; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_VIEW_WIDTH[marks]} 12`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      className="inline-block h-3.5 w-auto align-middle"
      fill="currentColor"
    >
      <path fillRule="evenodd" d={MARK_BARS.slice(0, marks).join("")} />
    </svg>
  );
}

function sortValue(t: TankListItem, key: string): number | string | null {
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
      const col = MOE_COLUMNS.find((c) => c.key === key);
      return col ? col.value(t) : null;
    }
  }
}

export function TanksMoeTable({
  region,
  rows,
}: {
  region: Region;
  rows: TankListItem[];
}) {
  const [sort, setSort] = useState<SortState>({
    key: "mark3",
    direction: SortDirection.Desc,
  });

  const sorted = useMemo(() => {
    const mul = sort.direction === SortDirection.Asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
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
  }, [rows, sort]);

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
              {MOE_COLUMNS.map((c) => (
                <SortHead key={c.key} sort={sort} col={c.key} onToggle={toggleSort} align="end" tip={c.tip}>
                  <MarkIcon marks={c.marks} label={c.label} />
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
                {MOE_COLUMNS.map((c) => {
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

function SortHead({
  sort,
  col,
  onToggle,
  align = "start",
  tip,
  headClassName,
  children,
}: {
  sort: SortState;
  col: string;
  onToggle: (c: string) => void;
  align?: "start" | "center" | "end";
  tip?: string;
  headClassName?: string;
  children: React.ReactNode;
}) {
  const active = sort.key === col;
  const Icon = active
    ? sort.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  const button = (
    <button
      type="button"
      onClick={() => onToggle(col)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1 px-3 py-2 font-medium select-none hover:text-foreground",
        align === "center" && "justify-center",
        align === "end" && "justify-end",
        active && "text-foreground",
      )}
    >
      {children}
      <Icon
        weight="bold"
        className={cn("size-3.5 shrink-0", active ? "opacity-100" : "opacity-40")}
      />
    </button>
  );
  return (
    <TableHead className={cn("p-0", headClassName)}>
      {tip ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tip}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </TableHead>
  );
}
