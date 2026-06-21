"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toRoman } from "roman-numerals";
import ROUTES from "@/constants/routes";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RatingMetric,
} from "@/constants/rating";
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
import { TankIcon } from "@/components/players/tank-icon";
import { TankopediaHeaderIcon } from "@/components/players/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Region } from "@/services/wargaming/wot";
import { masteryBadgeUrl } from "@/services/wargaming/wot/cdn";
import {
  type VehicleMeta,
} from "@/services/wargaming/wot/encyclopedia";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  RATING_COLOR_CLASS,
  winrateColor,
  wn7Color,
  wn8Color,
  type WN8Expected,
  wnxColor,
  type WNXExpected,
} from "@/services/wargaming/wot/ratings";
import type { TankStats } from "@/services/wargaming/wot/tanks";

enum SortColumn {
  Name = "name",
  Mastery = "mastery",
  Type = "type",
  Nation = "nation",
  Tier = "tier",
  Battles = "battles",
  WinRate = "winrate",
  AvgDamage = "avg_damage",
  AvgXp = "avg_xp",
  Rating = "rating",
}

enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

type SortState = { column: SortColumn; direction: SortDirection } | null;

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TYPE_ABBR: Record<string, string> = {
  heavyTank: "HT",
  mediumTank: "MT",
  lightTank: "LT",
  "AT-SPG": "TD",
  SPG: "SPG",
};

const MASTERY_LABEL: Record<number, string> = {
  4: "Ace Tanker",
  3: "1st Class",
  2: "2nd Class",
  1: "3rd Class",
};

type TankRow = {
  tank: TankStats;
  meta: VehicleMeta | null;
  avgDamage: number | null;
  avgXp: number | null;
  winrate: number | null;
  rating: number | null;
};

function buildRows(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
  metric: RatingMetric,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): TankRow[] {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  return tanks.map((tank) => {
    const meta = encyclopedia[String(tank.tank_id)] ?? null;
    const battles = tank.all.battles;
    const avgDamage =
      battles > 0 ? tank.all.damage_dealt / battles : null;
    // A tank with battles > 0 always has xp > 0 from those battles, so
    // xp === 0 here means the column wasn't populated yet (pre-migration
    // snapshots) — show "—" instead of "0".
    const avgXp =
      battles > 0 && Number.isFinite(tank.all.xp) && tank.all.xp > 0
        ? tank.all.xp / battles
        : null;
    const winrate = battles > 0 ? tank.all.wins / battles : null;
    let rating: number | null = null;
    if (battles > 0) {
      if (metric === RatingMetric.Wn7) {
        rating = computeWN7(
          {
            battles,
            wins: tank.all.wins,
            frags: tank.all.frags,
            damageDealt: tank.all.damage_dealt,
            spotted: tank.all.spotted,
            droppedCapturePoints: tank.all.dropped_capture_points,
          },
          meta?.tier ?? null,
        );
      } else if (metric === RatingMetric.Wn8) {
        rating = computeWN8([tank], wn8Expected, encyclopedia, wn8Fallback);
      } else {
        rating = computeWNX([tank], wnxExpected);
      }
    }
    return { tank, meta, avgDamage, avgXp, winrate, rating };
  });
}

function getSortValue(row: TankRow, column: SortColumn): number | string {
  switch (column) {
    case SortColumn.Name:
      return row.meta?.name?.toLowerCase() ?? "";
    case SortColumn.Mastery:
      return row.tank.mark_of_mastery ?? -1;
    case SortColumn.Type:
      return TYPE_ABBR[row.meta?.type ?? ""] ?? row.meta?.type ?? "";
    case SortColumn.Nation:
      return row.meta?.nation ?? "";
    case SortColumn.Tier:
      return row.meta?.tier ?? 0;
    case SortColumn.Battles:
      return row.tank.all.battles;
    case SortColumn.WinRate:
      return row.winrate ?? -1;
    case SortColumn.AvgDamage:
      return row.avgDamage ?? -1;
    case SortColumn.AvgXp:
      return row.avgXp ?? -1;
    case SortColumn.Rating:
      return row.rating ?? -1;
  }
}

function compareRows(a: TankRow, b: TankRow, state: SortState): number {
  if (!state) {
    // Default: most battles first.
    return b.tank.all.battles - a.tank.all.battles;
  }
  const mul = state.direction === SortDirection.Asc ? 1 : -1;
  const av = getSortValue(a, state.column);
  const bv = getSortValue(b, state.column);
  if (typeof av === "string" && typeof bv === "string") {
    return mul * av.localeCompare(bv);
  }
  return mul * ((av as number) - (bv as number));
}

function SortableHead({
  column,
  state,
  onToggle,
  align = "start",
  hideOnMobile,
  headClassName,
  tooltip,
  children,
}: {
  column: SortColumn;
  state: SortState;
  onToggle: (col: SortColumn) => void;
  align?: "start" | "center" | "end";
  hideOnMobile?: boolean;
  headClassName?: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  const active = state?.column === column;
  const Icon = active
    ? state.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  const button = (
    <button
      type="button"
      onClick={() => onToggle(column)}
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
  tanks,
  encyclopedia,
  wn8Expected,
  wnxExpected,
}: {
  region: Region;
  tanks: TankStats[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
}) {
  const [storedRating] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;
  const [sort, setSort] = useState<SortState>(null);

  const rows = buildRows(
    tanks.filter((t) => t.all.battles > 0),
    encyclopedia,
    metric,
    wn8Expected,
    wnxExpected,
  );
  const sorted = [...rows].sort((a, b) => compareRows(a, b, sort));

  function toggleSort(column: SortColumn) {
    setSort((prev) => {
      if (prev?.column !== column) {
        return { column, direction: SortDirection.Desc };
      }
      if (prev.direction === SortDirection.Desc) {
        return { column, direction: SortDirection.Asc };
      }
      return null;
    });
  }

  if (rows.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No tanks played yet.
      </p>
    );
  }

  function ratingColor(value: number | null): string {
    if (value === null) return "";
    if (metric === RatingMetric.Wn7) return RATING_COLOR_CLASS[wn7Color(value)];
    if (metric === RatingMetric.Wn8) return RATING_COLOR_CLASS[wn8Color(value)];
    return RATING_COLOR_CLASS[wnxColor(value)];
  }

  const metricLabel =
    metric === RatingMetric.Wn7
      ? "WN7"
      : metric === RatingMetric.Wn8
        ? "WN8"
        : "WNX";

  return (
    <TooltipProvider delayDuration={150}>
    <Table className="my-0! [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-3! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-3!">
      <TableHeader>
        <TableRow>
          <SortableHead
            column={SortColumn.Nation}
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
            column={SortColumn.Type}
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
            column={SortColumn.Tier}
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
          <SortableHead
            column={SortColumn.Name}
            state={sort}
            onToggle={toggleSort}
          >
            Name
          </SortableHead>
          <SortableHead
            column={SortColumn.Mastery}
            state={sort}
            onToggle={toggleSort}
            align="center"
            hideOnMobile
          >
            Mastery
          </SortableHead>
          <SortableHead
            column={SortColumn.Battles}
            state={sort}
            onToggle={toggleSort}
            align="end"
          >
            Battles
          </SortableHead>
          <SortableHead
            column={SortColumn.AvgDamage}
            state={sort}
            onToggle={toggleSort}
            align="end"
          >
            Avg damage
          </SortableHead>
          <SortableHead
            column={SortColumn.AvgXp}
            state={sort}
            onToggle={toggleSort}
            align="end"
            hideOnMobile
          >
            Avg XP
          </SortableHead>
          <SortableHead
            column={SortColumn.WinRate}
            state={sort}
            onToggle={toggleSort}
            align="end"
            tooltip="Overall (lifetime) winrate"
          >
            WR
          </SortableHead>
          <SortableHead
            column={SortColumn.Rating}
            state={sort}
            onToggle={toggleSort}
            align="end"
          >
            {metricLabel}
          </SortableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => {
          const tankId = r.tank.tank_id;
          const hasIcon = !!(r.meta?.tag && r.meta?.type);
          const name = r.meta?.shortName || r.meta?.name || `#${tankId}`;
          const mastery = r.tank.mark_of_mastery ?? null;
          const isPremium = r.meta?.isPremium ?? false;
          return (
            <TableRow key={tankId}>
              <TableCell className="hidden text-center sm:table-cell">
                {r.meta?.nation ? (
                  <NationFlag nation={r.meta.nation} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden text-center sm:table-cell">
                {r.meta?.type ? (
                  <VehicleTypeIcon
                    type={r.meta.type}
                    premium={r.meta.isPremium}
                  />
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
                {r.meta?.tier ? toRoman(r.meta.tier) : "—"}
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
                      tag={r.meta!.tag}
                      type={r.meta!.type}
                      className="h-3.5 w-auto shrink-0 object-contain"
                    />
                  ) : null}
                  {r.meta ? (
                    <Link
                      href={ROUTES.TANK(region, tankId)}
                      className="hover:underline"
                    >
                      {name}
                    </Link>
                  ) : (
                    <span>{name}</span>
                  )}
                </span>
              </TableCell>
              <TableCell className="hidden text-center text-xs sm:table-cell">
                {mastery && mastery > 0 ? (
                  <Image
                    src={masteryBadgeUrl(region, mastery)}
                    alt={MASTERY_LABEL[mastery]}
                    title={MASTERY_LABEL[mastery]}
                    width={28}
                    height={28}
                    className="mx-auto h-7 w-auto object-contain"
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {intFmt.format(r.tank.all.battles)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.avgDamage !== null ? intFmt.format(r.avgDamage) : "—"}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {r.avgXp !== null ? intFmt.format(r.avgXp) : "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  r.winrate !== null &&
                    RATING_COLOR_CLASS[winrateColor(r.winrate)],
                )}
              >
                {r.winrate !== null
                  ? `${pctFmt.format(r.winrate * 100)}%`
                  : "—"}
              </TableCell>
              <TableCell
                className={cn("text-right tabular-nums", ratingColor(r.rating))}
              >
                {r.rating !== null ? decFmt.format(r.rating) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </TooltipProvider>
  );
}
