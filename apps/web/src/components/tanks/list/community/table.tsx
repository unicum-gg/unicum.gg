"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { toRoman } from "roman-numerals";
import {
  RATING_COLOR_CLASS,
  RATING_HYPE_LABEL,
  ratingHype,
  RatingHype,
  starRatingColor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { Stars, StarTone } from "@/components/tanks/detail/community/stars";
import { SortDirection, SortHead, type SortState } from "../sorting";
import { TablePager, usePagination } from "@/components/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { CommunityBoardRow } from "./row";

const intFmt = new Intl.NumberFormat("en-US");
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

/**
 * Every vehicle players have judged, sortable.
 *
 * Built on the same skeleton as the other tank tables (nation, type and tier as
 * narrow icon columns, then the name, then the numbers right-aligned) because a
 * reader who has learned to scan one of them should not have to learn a second.
 * What is specific to this one is the last column: the gap between reputation
 * and results, which sorts both ways into the two lists nobody else can build,
 * the most overrated vehicles in the game and the most underrated.
 *
 * The score columns rank on the shrunk mean rather than the plain one shown in
 * the cell, so the top of the board cannot be whichever tank four people liked.
 */

enum Column {
  Nation = "nation",
  Type = "type",
  Tier = "tier",
  Name = "name",
  Overall = "overall",
  Fun = "fun",
  Votes = "votes",
  Hype = "hype",
}

type ValueColumn = {
  key: Column;
  label: string;
  tip: string;
  /** What the column sorts on, which is not always what it prints. */
  sort: (r: CommunityBoardRow) => number | null;
  /** What the cell shows, and the class the cell itself wears. A rating is a
   * filled block in the site's palette, the way WNX and win rate already are on
   * the performance table, so the three read as the same kind of column. */
  cell: (r: CommunityBoardRow) => { node: ReactNode; className?: string };
};

/**
 * A five-star score, in the cell.
 *
 * The block and its colour are the site's rating-column language, the one WNX
 * and win rate already speak on the performance table. The stars are this
 * feature's own, and they are on every other surface it touches, so leaving
 * them out here made the board read as somebody else's table.
 *
 * Both, then: the block carries the score, and the stars ride it in the cell's
 * own white, unfilled ones at a quarter opacity. Painting them on the rating
 * ladder here would be a coloured glyph on a coloured ground, which is the one
 * combination that cannot be read.
 */
function score(value: number | null): { node: ReactNode; className?: string } {
  if (value == null) return { node: DASH };
  return {
    node: (
      <span className="inline-flex items-center justify-end gap-2">
        <Stars value={value} size={11} tone={StarTone.Inherit} />
        {value.toFixed(2)}
      </span>
    ),
    className: RATING_COLOR_CLASS[starRatingColor(value)],
  };
}

const VALUE_COLUMNS: ValueColumn[] = [
  {
    key: Column.Overall,
    label: "Overall",
    tip: "How good players think it is. Ranked on a mean shrunk towards the site average, so a tank with four votes cannot outrank one with four hundred.",
    sort: (r) => r.overallBayes ?? r.overall,
    cell: (r) => score(r.overall),
  },
  {
    key: Column.Fun,
    label: "Fun",
    tip: "How much players enjoy it, which is regularly not the same question.",
    sort: (r) => r.funBayes ?? r.fun,
    cell: (r) => score(r.fun),
  },
  {
    key: Column.Votes,
    label: "Votes",
    tip: "Votes cast, every one from an account that has actually played the tank.",
    sort: (r) => r.votes,
    cell: (r) => ({ node: intFmt.format(r.votes) }),
  },
  {
    key: Column.Hype,
    label: "Reputation gap",
    tip: "Where the community ranks it in its tier, minus where its win rate ranks it. Sort descending for the most overrated tanks in the game, ascending for the most underrated.",
    sort: (r) => r.hype,
    cell: (r) => ({ node: <Gap hype={r.hype} /> }),
  },
];

function sortValue(
  r: CommunityBoardRow,
  key: string,
): number | string | null {
  switch (key) {
    case Column.Tier:
      return r.tier;
    case Column.Name:
      return (r.shortName || r.name).toLowerCase();
    case Column.Nation:
      return r.nation;
    case Column.Type:
      return r.type;
    default:
      return VALUE_COLUMNS.find((c) => c.key === key)?.sort(r) ?? null;
  }
}

export function CommunityTable({
  region,
  rows,
}: {
  region: Region;
  rows: CommunityBoardRow[];
}) {
  const [sort, setSort] = useState<SortState>({
    key: Column.Overall,
    direction: SortDirection.Desc,
  });

  const sorted = useMemo(() => {
    const mul = sort.direction === SortDirection.Asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      // The name breaks every tie, so re-sorting on a column with duplicates
      // does not shuffle the rows underneath the reader. Nulls sink whichever
      // way the column points: an unmeasured gap is not the smallest gap.
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

  const { paged, pager } = usePagination(sorted, 50);

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

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <Table className="my-0! [&_td]:py-1.5! [&_th]:whitespace-nowrap [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-4!">
          <TableHeader>
            <TableRow>
              <SortHead
                sort={sort}
                col={Column.Nation}
                onToggle={toggleSort}
                align="center"
                tip="Nation"
                headClassName="w-[72px] min-w-[72px]"
              >
                <TankopediaHeaderIcon name="nation" />
              </SortHead>
              <SortHead
                sort={sort}
                col={Column.Type}
                onToggle={toggleSort}
                align="center"
                tip="Type"
                headClassName="w-[72px] min-w-[72px]"
              >
                <TankopediaHeaderIcon name="type" />
              </SortHead>
              <SortHead
                sort={sort}
                col={Column.Tier}
                onToggle={toggleSort}
                align="center"
                tip="Tier"
                headClassName="w-[72px] min-w-[72px]"
              >
                <span className="text-xs font-medium tracking-tight text-fd-muted-foreground">
                  I-XI
                </span>
              </SortHead>
              <SortHead
                sort={sort}
                col={Column.Name}
                onToggle={toggleSort}
                headClassName="min-w-52"
              >
                Name
              </SortHead>
              {VALUE_COLUMNS.map((c) => (
                <SortHead
                  key={c.key}
                  sort={sort}
                  col={c.key}
                  onToggle={toggleSort}
                  align="end"
                  tip={c.tip}
                >
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
                  {/* Straight to the Community tab rather than the tank's
                    default one: this table is the way into a verdict. */}
                  <Link
                    href={`${ROUTES.TANK(region, t.slug)}/community`}
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
                {VALUE_COLUMNS.map((c) => {
                  const { node, className } = c.cell(t);
                  return (
                    <TableCell
                      key={c.key}
                      className={cn("text-right tabular-nums", className)}
                    >
                      {node}
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

/**
 * The gap as whole points of percentile, signed.
 *
 * Coloured as text rather than as a filled block, unlike the two rating columns
 * beside it: this is not a score on the site's ladder, it is a direction, and it
 * is painted the way the changes feed already paints a buff and a nerf. Three
 * filled blocks in a row would also read as three of the same thing.
 */
function Gap({ hype }: { hype: number | null }) {
  const verdict = ratingHype(hype);
  if (verdict == null || hype == null) return DASH;
  return (
    <span
      className={cn("font-medium", HYPE_CLASS[verdict])}
      title={RATING_HYPE_LABEL[verdict]}
    >
      {hype > 0 ? "+" : ""}
      {(hype * 100).toFixed(0)}
    </span>
  );
}

const HYPE_CLASS: Record<RatingHype, string> = {
  [RatingHype.Overrated]: "text-amber-500",
  [RatingHype.Fair]: "text-fd-muted-foreground",
  [RatingHype.Underrated]: "text-emerald-500",
};
