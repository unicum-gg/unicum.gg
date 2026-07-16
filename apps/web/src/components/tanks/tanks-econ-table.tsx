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
import {
  ColumnSelector,
  useColumnVisibility,
} from "@/components/tanks/column-visibility";
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
import {
  CREDITS_PER_GOLD,
  XP_PER_GOLD,
  goldToMoney,
  moneyFmt,
} from "@unicum.gg/shared";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}
type SortState = { key: string; direction: SortDirection };
const PAGE_SIZES = [25, 50, 100, 200] as const;
type PageSize = number | "all";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

type EconColumn = {
  key: string;
  label: string;
  tip?: string;
  render: (t: TankListItem) => ReactNode;
  sortValue: (t: TankListItem) => number | null;
};

// Colored currency chips.
const credits = (v: number | null): ReactNode =>
  v != null ? (
    <span className="text-[#E8B96A]">{intFmt.format(v)}</span>
  ) : (
    DASH
  );
const gold = (v: number | null): ReactNode =>
  v != null ? <span className="text-[#F2D45C]">{intFmt.format(v)}</span> : DASH;

// Real-money value of a gold amount in the region's store currency (green like
// the tank page's cost panel). Null renders a dash.
function moneyChip(
  fmt: Intl.NumberFormat | null,
  amount: number | null,
): ReactNode {
  return amount != null && fmt ? (
    <span className="text-emerald-400/90">~{fmt.format(amount)}</span>
  ) : (
    DASH
  );
}

// Real money to research this tank's line: the cheapest total XP from tier 1
// (modules included) priced as free XP. Region store currency.
function freeXpMoney(t: TankListItem, region: Region): number | null {
  const xp = t.specs?.totalFreeXp;
  return xp ? (goldToMoney(region, xp / XP_PER_GOLD)?.amount ?? null) : null;
}

// Real money to acquire this tank the normal way: research XP + credits price
// converted to gold and priced (or the gold price directly for premiums). Each
// component is priced then summed, matching the tank page's Total cost (the
// bundle estimate is non-linear, so summing golds first would misprice).
function acquireMoney(t: TankListItem, region: Region): number | null {
  const s = t.specs;
  if (!s) return null;
  // Reward tanks aren't store-purchasable (their `buyGold` in WG's data is a
  // restore placeholder, not a price), so a "buy cost" is meaningless for them.
  if (t.isReward) return null;
  const parts: number[] = [];
  if (s.buyGold) {
    const m = goldToMoney(region, s.buyGold)?.amount;
    if (m != null) parts.push(m);
  }
  if (s.researchXp) {
    const m = goldToMoney(region, s.researchXp / XP_PER_GOLD)?.amount;
    if (m != null) parts.push(m);
  }
  if (s.buyCredits) {
    const m = goldToMoney(region, s.buyCredits / CREDITS_PER_GOLD)?.amount;
    if (m != null) parts.push(m);
  }
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

function buildEconColumns(region: Region): EconColumn[] {
  const fmt = moneyFmt(region);
  const cur = fmt?.resolvedOptions().currency ?? "";
  const base: EconColumn[] = [
    {
      key: "buyCredits",
      label: "Cost (credits)",
      tip: "Purchase price in credits (tech-tree tanks)",
      render: (t) => credits(t.specs?.buyCredits ?? null),
      sortValue: (t) => t.specs?.buyCredits ?? null,
    },
    {
      key: "buyGold",
      label: "Cost (gold)",
      tip: "Purchase price in gold (premium tanks)",
      // Reward tanks carry a restore-price placeholder in `buyGold`, not a real
      // store price, and aren't purchasable — show a dash rather than mislead.
      render: (t) => gold(t.isReward ? null : (t.specs?.buyGold ?? null)),
      sortValue: (t) => (t.isReward ? null : (t.specs?.buyGold ?? null)),
    },
    {
      key: "researchXp",
      label: "Research XP",
      tip: "XP to unlock (cheapest path)",
      render: (t) =>
        t.specs?.researchXp != null ? intFmt.format(t.specs.researchXp) : DASH,
      sortValue: (t) => t.specs?.researchXp ?? null,
    },
    {
      key: "totalFreeXp",
      label: "Free XP (T1)",
      tip: "Cumulative XP to research from tier 1, prerequisite modules included",
      render: (t) =>
        t.specs?.totalFreeXp != null
          ? intFmt.format(t.specs.totalFreeXp)
          : DASH,
      sortValue: (t) => t.specs?.totalFreeXp ?? null,
    },
    {
      key: "shellCost",
      label: "Shell cost",
      tip: "Default shell price (credits)",
      render: (t) => credits(t.specs?.shellCost ?? null),
      sortValue: (t) => t.specs?.shellCost ?? null,
    },
    {
      key: "ammoCost",
      label: "Full ammo cost",
      tip: "Default shell price × ammo capacity",
      render: (t) => credits(t.specs?.ammoCost ?? null),
      sortValue: (t) => t.specs?.ammoCost ?? null,
    },
  ];
  if (!fmt) return base;
  const money: EconColumn[] = [
    {
      key: "acquireMoney",
      label: `Buy cost (${cur})`,
      tip: `Estimated real money to acquire the tank (research + purchase), in ${cur}`,
      render: (t) => moneyChip(fmt, acquireMoney(t, region)),
      sortValue: (t) => acquireMoney(t, region),
    },
    {
      key: "freeXpMoney",
      label: `Free XP (${cur})`,
      tip: `Estimated real money to free-XP the tank from tier 1, in ${cur}`,
      render: (t) => moneyChip(fmt, freeXpMoney(t, region)),
      sortValue: (t) => freeXpMoney(t, region),
    },
  ];
  return [...base, ...money];
}

// Selectable columns (currency-free labels; the table headers add the region
// currency). Keys must match `buildEconColumns`. All visible by default.
const ECON_COLUMN_META = [
  { key: "buyCredits", label: "Cost (credits)" },
  { key: "buyGold", label: "Cost (gold)" },
  { key: "researchXp", label: "Research XP" },
  { key: "totalFreeXp", label: "Free XP (T1)" },
  { key: "shellCost", label: "Shell cost" },
  { key: "ammoCost", label: "Full ammo cost" },
  { key: "acquireMoney", label: "Buy cost (money)" },
  { key: "freeXpMoney", label: "Free XP (money)" },
] as const;
const ECON_KEYS = ECON_COLUMN_META.map((c) => c.key);
const ECON_COOKIE = "unicum.econ_columns";
// Shell/ammo cost are niche, hidden by default to keep the table focused on
// acquisition cost; the selector brings them back.
const ECON_DEFAULT_KEYS = ECON_KEYS.filter(
  (k) => k !== "shellCost" && k !== "ammoCost",
);

function useEconColumns() {
  return useColumnVisibility(ECON_COOKIE, ECON_KEYS, ECON_DEFAULT_KEYS);
}

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
}: {
  region: Region;
  rows: TankListItem[];
}) {
  const [sort, setSort] = useState<SortState>({
    key: "buyCredits",
    direction: SortDirection.Desc,
  });

  const [selected] = useEconColumns();
  const columns = useMemo(
    () => buildEconColumns(region).filter((c) => selected.has(c.key)),
    [region, selected],
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
                  {c.label}
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
