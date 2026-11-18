"use client";

import { GlossaryLabel } from "@/components/glossary/label";
import { OnslaughtSortHead } from "@/components/players/list/onslaught/sort-head";
import {
  OnslaughtSortCol,
  type OnslaughtSortState,
} from "@/components/players/list/onslaught/row";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The standings' column row.
 *
 * Its own file because the board it belongs to is the page's whole subject and
 * was running past the length this project keeps a file to, and because this is
 * the one part of it that is purely the column list: what each column is called
 * and which of them a click re-sorts the board by.
 *
 * It reads its own strings rather than taking them, since both namespaces are
 * already in this route's scope and threading two `t` functions through a prop
 * is how a heading ends up read from the wrong catalogue.
 */
export function OnslaughtBoardHead({
  sort,
  setSort,
}: {
  sort: OnslaughtSortState;
  setSort: (sort: OnslaughtSortState) => void;
}) {
  const { t } = useTranslation("components/players/list/onslaught/view");
  const { t: tOwn } = useTranslation("components/players/list/onslaught/board");
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-16 text-center!">#</TableHead>
        <TableHead>{t("columns.player")}</TableHead>
        <TableHead className="hidden w-28 text-right! sm:table-cell">
          {/* The mode's own ladder, not a leaderboard position: the
          row's number is in the first column. */}
          <GlossaryLabel label={tOwn("onslaught")}>
            {t("columns.rank")}
          </GlossaryLabel>
        </TableHead>
        {/* The rates, folded from our own captures. Ahead of the two
        figures the source itself publishes, which keep the last
        columns they have always held, and hidden on a narrow screen:
        they are what this board adds, not what it is. */}
        <OnslaughtSortHead
          col={OnslaughtSortCol.BattlesPerDay}
          sort={sort}
          setSort={setSort}
          className="hidden w-32 xl:table-cell"
        >
          {t("columns.battles-per-day")}
        </OnslaughtSortHead>
        <OnslaughtSortHead
          col={OnslaughtSortCol.PointsPerDay}
          sort={sort}
          setSort={setSort}
          className="hidden w-32 xl:table-cell"
        >
          {t("columns.points-per-day")}
        </OnslaughtSortHead>
        <OnslaughtSortHead
          col={OnslaughtSortCol.PointsPerBattle}
          sort={sort}
          setSort={setSort}
          className="hidden w-32 xl:table-cell"
        >
          {t("columns.points-per-battle")}
        </OnslaughtSortHead>
        <OnslaughtSortHead
          col={OnslaughtSortCol.Battles}
          sort={sort}
          setSort={setSort}
          className="w-24"
        >
          {t("columns.battles")}
        </OnslaughtSortHead>
        <OnslaughtSortHead
          col={OnslaughtSortCol.Rating}
          sort={sort}
          setSort={setSort}
          className="w-32"
        >
          {t("columns.rating")}
        </OnslaughtSortHead>
      </TableRow>
    </TableHeader>
  );
}
