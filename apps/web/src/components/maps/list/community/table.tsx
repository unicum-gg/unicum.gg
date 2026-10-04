"use client";

import type { NumberFormatter } from "@/lib/format";
import { useFormat } from "@/hooks/use-format";
import Link from "@/components/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  RATING_COLOR_CLASS,
  ratingConsensus,
  RatingConsensus,
  starRatingColor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { MinimapImage } from "@/components/maps/minimap-image";
import { MapCommonTestBadge } from "@/components/maps/common-test-badge";
import { CAMO_META } from "@/components/maps/meta";
import { Stars, StarTone } from "@/components/tanks/detail/community/stars";
import {
  SortDirection,
  SortHead,
  type SortState,
} from "@/components/tanks/list/sorting";
import { TablePager, usePagination } from "@/components/table-pager";
import PAGINATION from "@/constants/pagination";
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
import { mapName } from "@/components/game-name";
import { useTranslation } from "@/hooks/use-translation";
import type { MapCommunityRow } from "./row";

const INT_FORMAT = {} as const;
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

/**
 * Every map players have judged, sortable.
 *
 * Built on the vehicle board's skeleton (a narrow icon column, then the name,
 * then the numbers right-aligned) because a reader who has learned to scan one
 * of them should not have to learn a second. The score columns likewise rank on
 * the shrunk mean rather than the plain one shown in the cell, so the top of the
 * board cannot be whichever map four people liked.
 *
 * Two columns the vehicle board has are deliberately absent. There is no tier,
 * because a map has none. And there is no reputation gap: that column is the
 * community's rank inside a tier minus the subject's measured win-rate rank
 * inside the same tier, and no per-arena win rate exists anywhere, so there is
 * nothing to subtract. What takes its place is the spread, which on a map is
 * the more interesting number anyway: a 3.0 everyone agrees on and a 3.0 half
 * the server fought over are different facts about the ground.
 */

enum Column {
  Camouflage = "camouflage",
  Name = "name",
  Overall = "overall",
  Fun = "fun",
  Votes = "votes",
  Consensus = "consensus",
}

type ValueColumn = {
  key: Column;
  /** Keyed by `key`, the heading and the explanation its tooltip shows. */
  label: string;
  /** What the column sorts on, which is not always what it prints. */
  sort: (r: MapCommunityRow) => number | null;
  /** What the cell shows, and the class the cell itself wears. A rating is a
   * filled block in the site's palette, the way WNX and win rate already are on
   * the performance table, so the columns read as the same kind of thing. */
  cell: (
    r: MapCommunityRow,
    num: NumberFormatter,
  ) => { node: ReactNode; className?: string };
};

/**
 * A five-star score, in the cell.
 *
 * The block and its colour are the site's rating-column language. The stars are
 * this feature's own and are on every other surface it touches, so leaving them
 * out made the vehicle board read as somebody else's table. Both, then: the
 * block carries the score and the stars ride it in the cell's own white, since
 * painting them on the rating ladder here would be a coloured glyph on a
 * coloured ground.
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
    label: "overall",
    sort: (r) => r.overallBayes ?? r.overall,
    cell: (r) => score(r.overall),
  },
  {
    key: Column.Fun,
    label: "fun",
    sort: (r) => r.funBayes ?? r.fun,
    cell: (r) => score(r.fun),
  },
  {
    key: Column.Votes,
    label: "votes",
    sort: (r) => r.votes,
    cell: (r, num) => ({ node: num(INT_FORMAT).format(r.votes) }),
  },
  {
    key: Column.Consensus,
    label: "agreement",
    // The spread itself, so sorting descending puts the maps players cannot
    // agree on at the top, which is the question this column is asked.
    sort: (r) => r.overallStddev,
    cell: (r) => ({
      node: <Agreement stddev={r.overallStddev} votes={r.votes} />,
    }),
  },
];

export function MapCommunityTable({
  region,
  rows,
}: {
  region: Region;
  rows: MapCommunityRow[];
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/maps/list/community/table");
  const { t: tMaps } = useTranslation("game/maps");
  const { t: tGame } = useTranslation("game/vocabulary");
  const [sort, setSort] = useState<SortState>({
    key: Column.Overall,
    direction: SortDirection.Desc,
  });

  // Named before sorting, so the order follows what the reader actually sees:
  // the catalogue's English name is only the tie-breaker.
  const named = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        displayName: mapName(row.arenaId, row.name, tMaps),
      })),
    [rows, tMaps],
  );

  const sorted = useMemo(() => {
    const mul = sort.direction === SortDirection.Asc ? 1 : -1;
    const value = (r: (typeof named)[number]): number | string | null => {
      switch (sort.key) {
        case Column.Name:
          return r.displayName.toLowerCase();
        case Column.Camouflage:
          return r.camouflage;
        default:
          return VALUE_COLUMNS.find((c) => c.key === sort.key)?.sort(r) ?? null;
      }
    };
    return [...named].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      // The name breaks every tie, so re-sorting on a column with duplicates
      // does not shuffle the rows underneath the reader. Nulls sink whichever
      // way the column points: an unknown spread is not the smallest spread.
      if (av === null && bv === null)
        return a.displayName.localeCompare(b.displayName);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return (
          mul * av.localeCompare(bv) ||
          a.displayName.localeCompare(b.displayName)
        );
      }
      return (
        mul * ((av as number) - (bv as number)) ||
        a.displayName.localeCompare(b.displayName)
      );
    });
  }, [named, sort]);

  // No `crawlable` and no `page`: the catalogue is around fifty arenas, so this
  // board is one page and there is no `/page/[n]` route to link to. The pager
  // still renders its rows-per-page control and its range.
  const { paged, pager } = usePagination(sorted, PAGINATION.SIZE.CATALOGUE);

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
                col={Column.Camouflage}
                onToggle={toggleSort}
                align="center"
                tip={t("camouflage")}
                headClassName="w-[72px] min-w-[72px]"
              >
                <span className="text-xs font-medium tracking-tight text-fd-muted-foreground">
                  {t("season")}
                </span>
              </SortHead>
              <SortHead
                sort={sort}
                col={Column.Name}
                onToggle={toggleSort}
                headClassName="min-w-52"
              >
                {t("map")}
              </SortHead>
              {VALUE_COLUMNS.map((c) => (
                <SortHead
                  key={c.key}
                  sort={sort}
                  col={c.key}
                  onToggle={toggleSort}
                  align="end"
                  tip={t(`tips.${c.key}`)}
                >
                  {t(c.label)}
                </SortHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row) => {
              const camo = CAMO_META[row.camouflage];
              const CamoIcon = camo.icon;
              return (
                <TableRow key={row.arenaId}>
                  <TableCell className="text-center">
                    <span
                      className={camo.className}
                      title={tGame(`map-camouflage.${row.camouflage}`)}
                    >
                      <CamoIcon
                        weight="fill"
                        className="mx-auto size-4 shrink-0"
                      />
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      // Straight to the Community tab rather than the
                      // map’s default one: this table is the way into a verdict.
                      href={`${ROUTES.MAP(region, row.slug)}/community`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <MinimapImage
                        src={row.minimapUrl}
                        arenaId={row.arenaId}
                        commonTest={row.commonTest}
                        alt={row.displayName}
                        sizes="24px"
                        className="size-6 shrink-0 rounded-sm object-cover"
                      />
                      <span className="min-w-0 truncate">
                        {row.displayName}
                      </span>
                      {row.commonTest ? <MapCommonTestBadge size={13} /> : null}
                    </Link>
                  </TableCell>
                  {VALUE_COLUMNS.map((c) => {
                    const { node, className } = c.cell(row, num);
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
              );
            })}
          </TableBody>
        </Table>
      </div>
      <TablePager pager={pager} />
    </TooltipProvider>
  );
}

/**
 * How far apart the voters sit, in words rather than as a number.
 *
 * Coloured as text rather than as a filled block, unlike the two rating columns
 * beside it: this is not a score on the site's ladder, it is a reading, and
 * three filled blocks in a row would read as three of the same thing. Null
 * under ten votes, where a spread is noise rather than a disagreement, which is
 * the same threshold the map page's own heading uses.
 */
function Agreement({
  stddev,
  votes,
}: {
  stddev: number | null;
  votes: number;
}) {
  const { t: tLabel } = useTranslation("components/labels");
  const verdict = ratingConsensus(stddev, votes);
  if (verdict == null) return DASH;
  return (
    <span className={cn("font-medium", CONSENSUS_CLASS[verdict])}>
      {tLabel(`rating-consensus.${verdict}`)}
    </span>
  );
}

const CONSENSUS_CLASS: Record<RatingConsensus, string> = {
  [RatingConsensus.Agreed]: "text-emerald-500",
  [RatingConsensus.Mixed]: "text-fd-muted-foreground",
  [RatingConsensus.Divisive]: "text-amber-500",
};
