"use client";

import { useFormat } from "@/hooks/use-format";
import { SortDirection, type SortState, SortHead } from "../sorting";
import { TablePager, usePagination } from "@/components/table-pager";
import PAGINATION from "@/constants/pagination";
import { type ReactNode, useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankRowName } from "@/components/tanks/list/row-name";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  ColumnSelector,
  useColumnVisibility,
} from "@/components/tanks/list/column-visibility";
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
import { useTranslation } from "@/hooks/use-translation";


const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

type MoeColumn = {
  key: string;
  marks: 1 | 2 | 3;
  value: (t: TankListItem) => number | null;
};

// The three marks map to WG's 65/85/95th combined-damage percentiles. The mark
// glyph is drawn as 1/2/3 tally bars (see MarkIcon); the exact percentile lives
// in the tooltip.
const MOE_COLUMNS: MoeColumn[] = [
  {
    key: "mark1",
    marks: 1,
    value: (t) => t.moe?.mark1 ?? null,
  },
  {
    key: "mark2",
    marks: 2,
    value: (t) => t.moe?.mark2 ?? null,
  },
  {
    key: "mark3",
    marks: 3,
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

const MOE_KEYS = MOE_COLUMNS.map((c) => c.key);
const MOE_COOKIE = "unicum.moe_columns";

function useMoeColumns() {
  return useColumnVisibility(MOE_COOKIE, MOE_KEYS, MOE_KEYS);
}

export function MoeColumnSelector() {
  const { t: tGame } = useTranslation("game/vocabulary");
  const [selected, onToggle] = useMoeColumns();
  return (
    <ColumnSelector
      items={MOE_COLUMNS}
      selected={selected}
      onToggle={onToggle}
      label={(key) => tGame(`marks.${key.replace("mark", "")}`)}
    />
  );
}

function sortValue(
  t: TankListItem,
  key: string,
  columns: MoeColumn[],
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

export function TanksMoeTable({
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
  const { t } = useTranslation("components/tanks/list/marks-of-excellence/index");
  const { t: tGame } = useTranslation("game/vocabulary");
  const { t: tTable } = useTranslation("components/tanks/table");
  const [sort, setSort] = useState<SortState>({
    key: "mark3",
    direction: SortDirection.Desc,
  });

  const [selected] = useMoeColumns();
  const columns = useMemo(
    () => MOE_COLUMNS.filter((c) => selected.has(c.key)),
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
                <SortHead key={c.key} sort={sort} col={c.key} onToggle={toggleSort} align="end" tip={t(`columns.${c.key}.tip`)}>
                  <MarkIcon marks={c.marks} label={tGame(`marks.${c.marks}`)} />
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
                {columns.map((c) => {
                  const v = c.value(t);
                  return (
                    <TableCell key={c.key} className="text-right tabular-nums">
                      {v != null ? num(INT_FORMAT).format(v) : DASH}
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