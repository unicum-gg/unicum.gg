"use client";

import { useFormat } from "@/hooks/use-format";
import { SortDirection, type SortState, SortHead } from "../sorting";
import { TablePager, usePagination } from "@/components/table-pager";
import PAGINATION from "@/constants/pagination";
import Image from "next/image";
import { type ReactNode, useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { portalIconUrl, type Region } from "@unicum.gg/wargaming";
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
import { useTranslation } from "@/hooks/use-translation";


const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

type MasteryColumn = {
  key: string;
  iconFile: string;
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
    iconFile: "rank_03.png",
    value: (t) => t.mastery?.class3 ?? null,
  },
  {
    key: "class2",
    iconFile: "rank_02.png",
    value: (t) => t.mastery?.class2 ?? null,
  },
  {
    key: "class1",
    iconFile: "rank_01.png",
    value: (t) => t.mastery?.class1 ?? null,
  },
  {
    key: "ace",
    iconFile: "rank_m.png",
    value: (t) => t.mastery?.ace ?? null,
  },
];

const MASTERY_KEYS = MASTERY_COLUMNS.map((c) => c.key);
const MASTERY_COOKIE = "unicum.mom_columns";

function useMasteryColumns() {
  return useColumnVisibility(MASTERY_COOKIE, MASTERY_KEYS, MASTERY_KEYS);
}

export function MasteryColumnSelector() {
  const { t: tGame } = useTranslation("game/vocabulary");
  const [selected, onToggle] = useMasteryColumns();
  return (
    <ColumnSelector
      items={MASTERY_COLUMNS}
      selected={selected}
      onToggle={onToggle}
      label={(key) => tGame(`mastery-badges.${key}`)}
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
  selection,
}: {
  region: Region;
  rows: TankListItem[];
  /** When set, each row offers a comparison checkbox. */
  selection?: TankSelection;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/tanks/list/marks-of-mastery/index");
  const { t: tGame } = useTranslation("game/vocabulary");
  const { t: tTable } = useTranslation("components/tanks/table");
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
                  <Image
                    src={portalIconUrl(region, c.iconFile)}
                    alt={tGame(`mastery-badges.${c.key}`)}
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