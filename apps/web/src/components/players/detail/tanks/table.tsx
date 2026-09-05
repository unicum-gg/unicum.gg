"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toRoman } from "roman-numerals";
import ROUTES from "@/constants/routes";
import { DEFAULT_RATING_METRIC, isRatingMetric, RatingMetric, type PlayerTankRow } from "@unicum.gg/shared";
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
import { NationFlag } from "@/components/tanks/nation-flag";
import {
  PLAYER_COLUMNS,
  PLAYER_COLUMN_BY_KEY,
  PlayerColumnSelector,
  ratingForMetric,
  COMPACT_COLUMN_KEYS,
  usePlayerColumns,
} from "@/components/players/detail/tanks/vehicle-columns";
import { TankIcon } from "@/components/tanks/tank-icon";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { TablePager, usePagination } from "@/components/table-pager";
import { metricLabel } from "@/components/tanks/perf-columns";
import { TankFilterBar } from "@/components/tanks/tank-filter-bar";
import { type RangeColumn, useTankFilters } from "@/hooks/use-tank-filters";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
import { cn } from "@/lib/utils";
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
  row: PlayerTankRow,
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
  a: PlayerTankRow,
  b: PlayerTankRow,
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
      {/* The heading the reader sees when it is words, the tooltip when it is
          an icon: the nation, class and tier columns show a glyph, and their
          tip is the one place their name is written. */}
      <GlossaryHeadTooltip
        label={typeof children === "string" ? children : undefined}
        fallbackLabel={tooltip}
        tip={tooltip}
      >
        {button}
      </GlossaryHeadTooltip>
    </TableHead>
  );
}

export function PlayerTanksTable({
  region,
  nickname,
  vehicles,
  selectedSlug,
}: {
  region: Region;
  nickname: string;
  vehicles: PlayerTankRow[];
  /** The vehicle whose record is open beside the table, highlighted here so the
   * two halves agree on what is being read. */
  selectedSlug?: string | null;
}) {
  const router = useRouter();
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
  const rangeCols: RangeColumn<PlayerTankRow>[] = useMemo(
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

  // The filter hook names these for what they hold, since the tank catalogue
  // already uses `moe`/`mom` for the region's thresholds. Mapped rather than
  // renamed on the row, so the rest of the table keeps reading `moe`/`mom`.
  const filterable = useMemo(
    () =>
      vehicles.map((v) => ({ ...v, gunMarks: v.moe, masteryBadge: v.mom })),
    [vehicles],
  );
  const { filtered, filters } = useTankFilters(filterable, rangeCols, "battles");
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareRows(a, b, sort, metric)),
    [filtered, sort, metric],
  );
  const { paged, pager } = usePagination(sorted);

  // Bring the open record's row to the reader rather than making them hunt for
  // it. Two steps, because the list is paginated: the tank someone shared a
  // link to is often not on page 1 at all.
  const selectedIndex = useMemo(
    () =>
      selectedSlug ? sorted.findIndex((r) => r.slug === selectedSlug) : -1,
    [sorted, selectedSlug],
  );
  // Only when the selection itself changes, so paging away from the open
  // record afterwards is not undone on the next render.
  const [pagedFor, setPagedFor] = useState<string | null>(null);
  if (selectedSlug && selectedSlug !== pagedFor) {
    setPagedFor(selectedSlug);
    if (selectedIndex >= 0 && pager.pageSize !== "all") {
      const wanted = Math.floor(selectedIndex / pager.pageSize) + 1;
      if (wanted !== pager.page) pager.setPage(wanted);
    }
  }

  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    // `nearest`: a row already on screen (the one just clicked) does not move,
    // and one arrived at by link is scrolled just far enough to be read.
    selectedRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedSlug, pager.page]);
  // Beside an open record the list has a third less width, so it shows the
  // game's own columns and lets the record carry the rest.
  const visibleColumns = useMemo(
    () =>
      PLAYER_COLUMNS.filter(
        (c) =>
          visibleKeys.has(c.key) &&
          (!selectedSlug || COMPACT_COLUMN_KEYS.has(c.key)),
      ),
    [visibleKeys, selectedSlug],
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
          // Hidden while a record is open: the columns are imposed then, and a
          // picker that answers "7 of 7" over a four-column table is a lie.
          extra={selectedSlug ? undefined : <PlayerColumnSelector />}
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
                const selected = selectedSlug != null && r.slug === selectedSlug;
                return (
                  <TableRow
                    key={r.tankId}
                    ref={selected ? selectedRowRef : undefined}
                    // The row opens this player's record on the tank, which
                    // is a URL of its own. The name inside is a real link to
                    // the same place, so the destination does not depend on
                    // where in the row the reader clicked.
                    onClick={() => {
                      if (r.slug) {
                        // `scroll: false`: the reader is picking a row half way
                        // down 157 of them, and the record opens beside it.
                        // Jumping to the top of the page would take both the
                        // row and the record they just asked for off screen.
                        router.push(
                          ROUTES.PLAYER_TANK(region, nickname, r.slug),
                          { scroll: false },
                        );
                      }
                    }}
                    className={cn(
                      r.slug && "cursor-pointer",
                      // A left edge rather than a row tint: the rating columns
                      // paint their own cells, so a background would show
                      // through on some columns and not others.
                      selected &&
                        "bg-fd-secondary/40 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-brand",
                    )}
                  >
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
                        // Never wrapped: a name folding onto three lines is
                        // what makes a narrowed table look broken, and the
                        // container scrolls when it has to.
                        "font-medium whitespace-nowrap max-sm:pl-4!",
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
                            // Same destination as the row around it. Sending
                            // the name to the vehicle's own page instead made
                            // one row answer two ways depending on where it
                            // was clicked, which reads as a broken link rather
                            // than a second destination. The vehicle's page
                            // stays one click away, from the heading of the
                            // record this opens.
                            href={ROUTES.PLAYER_TANK(region, nickname, r.slug)}
                            scroll={false}
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
