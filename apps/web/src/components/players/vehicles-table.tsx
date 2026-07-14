"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import ROUTES from "@/constants/routes";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RatingMetric,
} from "@unicum.gg/core/constants/rating";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NationFlag } from "@/components/players/nation-flag";
import {
  PLAYER_COLUMNS,
  PLAYER_COLUMN_BY_KEY,
  PlayerColumnSelector,
  ratingForMetric,
  usePlayerColumns,
} from "@/components/players/player-vehicle-columns";
import { TankIcon } from "@/components/players/tank-icon";
import { TankopediaHeaderIcon } from "@/components/players/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import { TablePager, usePagination } from "@/components/table-pager";
import { metricLabel } from "@/components/tanks/perf-columns";
import {
  type RangeColumn,
  TankFilterBar,
  useTankFilters,
} from "@/components/tanks/tank-filter-bar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PlayerVehicleRow } from "@unicum.gg/core/players/vehicles";
import type { Region } from "@unicum.gg/wargaming";

enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

type SortState = { key: string; direction: SortDirection } | null;

const TYPE_ABBR: Record<string, string> = {
  heavyTank: "HT",
  mediumTank: "MT",
  lightTank: "LT",
  "AT-SPG": "TD",
  SPG: "SPG",
};

function sortValue(
  row: PlayerVehicleRow,
  key: string,
  metric: RatingMetric,
): number | string {
  switch (key) {
    case "nation":
      return row.nation ?? "";
    case "type":
      return TYPE_ABBR[row.type ?? ""] ?? row.type ?? "";
    case "tier":
      return row.tier ?? 0;
    case "name":
      return row.name.toLowerCase();
    default:
      return PLAYER_COLUMN_BY_KEY[key]?.sortValue(row, metric) ?? -1;
  }
}

function compareRows(
  a: PlayerVehicleRow,
  b: PlayerVehicleRow,
  state: SortState,
  metric: RatingMetric,
): number {
  // Default: most battles first.
  if (!state) return b.battles - a.battles;
  const mul = state.direction === SortDirection.Asc ? 1 : -1;
  const av = sortValue(a, state.key, metric);
  const bv = sortValue(b, state.key, metric);
  if (typeof av === "string" && typeof bv === "string") {
    return mul * av.localeCompare(bv);
  }
  return mul * ((av as number) - (bv as number));
}

function SortableHead({
  col,
  state,
  onToggle,
  align = "start",
  hideOnMobile,
  headClassName,
  tooltip,
  children,
}: {
  col: string;
  state: SortState;
  onToggle: (key: string) => void;
  align?: "start" | "center" | "end";
  hideOnMobile?: boolean;
  headClassName?: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  const active = state?.key === col;
  const Icon = active
    ? state.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  const button = (
    <button
      type="button"
      onClick={() => onToggle(col)}
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
  );
  return (
    <TableHead
      className={cn(
        "p-0",
        hideOnMobile && "hidden sm:table-cell",
        headClassName,
      )}
    >
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </TableHead>
  );
}

export function PlayerVehiclesTable({
  region,
  vehicles,
}: {
  region: Region;
  vehicles: PlayerVehicleRow[];
}) {
  const [storedRating] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;
  const [sort, setSort] = useState<SortState>({
    key: "battles",
    direction: SortDirection.Desc,
  });
  const [visibleKeys] = usePlayerColumns();

  // Numeric columns the min/max range filter can target (the rating column
  // follows the selected metric, like the table's own rating column).
  const rangeCols: RangeColumn<PlayerVehicleRow>[] = useMemo(
    () => [
      { key: "battles", label: "Battles", value: (r) => r.battles },
      { key: "avgDamage", label: "Avg damage", value: (r) => r.avgDamage },
      { key: "avgXp", label: "Avg XP", value: (r) => r.avgXp },
      {
        key: "winrate",
        label: "WR %",
        value: (r) => (r.winrate != null ? r.winrate * 100 : null),
      },
      {
        key: "rating",
        label: metricLabel(metric),
        value: (r) => ratingForMetric(r, metric),
      },
    ],
    [metric],
  );

  const { filtered, filters } = useTankFilters(vehicles, rangeCols, "battles");
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareRows(a, b, sort, metric)),
    [filtered, sort, metric],
  );
  const { paged, pager } = usePagination(sorted);
  const visibleColumns = useMemo(
    () => PLAYER_COLUMNS.filter((c) => visibleKeys.has(c.key)),
    [visibleKeys],
  );

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: SortDirection.Desc };
      if (prev.direction === SortDirection.Desc)
        return { key, direction: SortDirection.Asc };
      return null;
    });
  }

  if (vehicles.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No tanks played yet.</p>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-4">
        <TankFilterBar
          filters={filters}
          searchNoun="tanks"
          extra={<PlayerColumnSelector />}
        />
      </div>
      <div className="border-t border-fd-border">
        {sorted.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No tanks match these filters.
          </p>
        ) : (
          <>
          <Table className="my-0! [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-3! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-3!">
            <TableHeader>
              <TableRow>
                <SortableHead
                  col="nation"
                  state={sort}
                  onToggle={toggleSort}
                  align="center"
                  hideOnMobile
                  headClassName="w-px"
                  tooltip="Nation"
                >
                  <TankopediaHeaderIcon name="nation" />
                </SortableHead>
                <SortableHead
                  col="type"
                  state={sort}
                  onToggle={toggleSort}
                  align="center"
                  hideOnMobile
                  headClassName="w-px"
                  tooltip="Type"
                >
                  <TankopediaHeaderIcon name="type" />
                </SortableHead>
                <SortableHead
                  col="tier"
                  state={sort}
                  onToggle={toggleSort}
                  align="center"
                  hideOnMobile
                  headClassName="w-px"
                  tooltip="Tier"
                >
                  <span className="whitespace-nowrap text-xs font-medium tracking-tight text-fd-muted-foreground">
                    I-XI
                  </span>
                </SortableHead>
                <SortableHead col="name" state={sort} onToggle={toggleSort}>
                  Name
                </SortableHead>
                {visibleColumns.map((c) => (
                  <SortableHead
                    key={c.key}
                    col={c.key}
                    state={sort}
                    onToggle={toggleSort}
                    align={c.align}
                    hideOnMobile={c.hideOnMobile}
                    tooltip={c.tip}
                  >
                    {c.header ? c.header(metric) : c.label}
                  </SortableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r) => {
                const hasIcon = !!(r.tag && r.type);
                const name = r.shortName || r.name || `#${r.tankId}`;
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
                      <span className="flex items-center gap-2">
                        {hasIcon ? (
                          <TankIcon
                            region={region}
                            tag={r.tag!}
                            type={r.type!}
                            className="h-3.5 w-auto shrink-0 object-contain"
                          />
                        ) : null}
                        {r.slug ? (
                          <Link
                            href={ROUTES.TANK(region, r.slug)}
                            className="hover:underline"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span>{name}</span>
                        )}
                      </span>
                    </TableCell>
                    {visibleColumns.map((c) => {
                      const { node, className } = c.cell(r, { region, metric });
                      return (
                        <TableCell
                          key={c.key}
                          className={cn(
                            "tabular-nums",
                            c.align === "center" && "text-center",
                            c.align === "end" && "text-right",
                            c.hideOnMobile && "hidden sm:table-cell",
                            className,
                          )}
                        >
                          {node}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePager pager={pager} />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
