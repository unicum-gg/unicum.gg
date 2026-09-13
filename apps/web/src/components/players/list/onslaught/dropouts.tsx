"use client";

import { useCallback, useMemo } from "react";
import { identityFromRow } from "@/components/entity/player-identity";
import { PlayerName } from "@/components/entity/player-name";
import { FilterSubject } from "@/components/filter-subject";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import {
  DropoutSortCol,
  type DropoutSortState,
  SortDirection,
} from "@/components/players/list/onslaught/row";
import { OnslaughtSortHead } from "@/components/players/list/onslaught/sort-head";
import { RelativeTime } from "@/components/relative-time";
import { TablePager, usePagination } from "@/components/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ROUTES from "@/constants/routes";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const PAGE_SIZE = 25;

/** Shape of the `dropouts` array on the `/players/onslaught` response. */
export type OnslaughtDropoutRow = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  bestRank: number;
  lastRank: number;
  lastRating: number;
  battles: number;
  lastSeenAt: number;
  is_verified: boolean;
  is_supporter: boolean;
  twitch_login: string | null;
  tournament_wins: number;
  tournament_featured_wins: number;
  tournament_best_title: string | null;
};

/** The value one column sorts on. Every column here is a number, the date
 * included, since it crosses the wire as epoch seconds. */
function sortValue(row: OnslaughtDropoutRow, col: DropoutSortCol): number {
  switch (col) {
    case DropoutSortCol.BestRank:
      return row.bestRank;
    case DropoutSortCol.LastRank:
      return row.lastRank;
    case DropoutSortCol.Rating:
      return row.lastRating;
    case DropoutSortCol.Battles:
      return row.battles;
    case DropoutSortCol.LeftAt:
      return row.lastSeenAt;
  }
}

/**
 * The players who held a place this season and lost it.
 *
 * The standings we serve are the present tense: the capture reads the board as
 * it stands and prunes anyone who has left it, so a fifth of the accounts that
 * held a place this season are absent from the table beside this one. They are
 * recovered from the daily fold, which keeps the days they were seen on it.
 *
 * Newest first by default, because the interesting question is who just lost
 * one, and it carries the same search, range filter and sortable columns as the
 * standings beside it: a table of the same size about the same players has to
 * answer everything the board can be asked.
 *
 * A table and not a panel: it is the second view of the board's own panel, so
 * that the page never shows two tables at once.
 */
export function OnslaughtDropoutsTable({
  region,
  dropouts,
  sort,
  setSort,
}: {
  region: Region;
  dropouts: OnslaughtDropoutRow[];
  sort: DropoutSortState;
  setSort: (s: DropoutSortState) => void;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/list/onslaught/dropouts");

  // A place is remembered by who held it, so the search matches the nickname
  // and the clan like the standings' does. There is no recorded name to also
  // match on: the row that carried it is what the prune removed.
  const searchFields = useCallback(
    (r: OnslaughtDropoutRow) => [r.nickname, r.clan_tag],
    [],
  );
  const rangeCols = useMemo<RangeColumn<OnslaughtDropoutRow>[]>(
    () => [
      {
        key: DropoutSortCol.BestRank,
        label: t("columns.best-rank"),
        value: (r) => r.bestRank,
      },
      {
        key: DropoutSortCol.LastRank,
        label: t("columns.last-rank"),
        value: (r) => r.lastRank,
      },
      {
        key: DropoutSortCol.Rating,
        label: t("columns.rating"),
        value: (r) => r.lastRating,
      },
      {
        key: DropoutSortCol.Battles,
        label: t("columns.battles"),
        value: (r) => r.battles,
      },
    ],
    [t],
  );
  // Its own four parameters, since the standings' hook stays mounted behind
  // this view and its columns are not these.
  const { filtered, filters } = useLeaderboardFilter(dropouts, {
    searchFields,
    rangeCols,
    initialRangeCol: DropoutSortCol.BestRank,
    syncUrl: true,
    paramPrefix: "lost-",
  });

  const sorted = useMemo(() => {
    const sign = sort.dir === SortDirection.Asc ? 1 : -1;
    return [...filtered].sort(
      (a, b) => (sortValue(a, sort.col) - sortValue(b, sort.col)) * sign,
    );
  }, [filtered, sort]);
  const { paged, pager } = usePagination(sorted, PAGE_SIZE, {
    // Its own param: this table stays mounted behind the standings, so on the
    // shared `?page=` one view's page would move the other's. Buttons, not
    // links: no route names a page of the places that were lost.
    param: "dropouts",
  });

  return (
    <>
      <div className="border-b border-fd-border px-4 py-2.5">
        <LeaderboardFilterBar
          filters={filters}
          searchNoun={FilterSubject.Players}
        />
      </div>
      {sorted.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("no-match")}
        </div>
      ) : (
        <Table
          className={cn(
            "my-0! table-fixed",
            "[&_td]:min-w-0 [&_td]:py-2!",
            "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
            "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
          )}
        >
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.player")}</TableHead>
              <OnslaughtSortHead
                col={DropoutSortCol.BestRank}
                sort={sort}
                setSort={setSort}
                className="w-28"
              >
                {t("columns.best-rank")}
              </OnslaughtSortHead>
              <OnslaughtSortHead
                col={DropoutSortCol.LastRank}
                sort={sort}
                setSort={setSort}
                className="hidden w-28 sm:table-cell"
              >
                {t("columns.last-rank")}
              </OnslaughtSortHead>
              <OnslaughtSortHead
                col={DropoutSortCol.Rating}
                sort={sort}
                setSort={setSort}
                className="hidden w-32 md:table-cell"
              >
                {t("columns.rating")}
              </OnslaughtSortHead>
              <OnslaughtSortHead
                col={DropoutSortCol.Battles}
                sort={sort}
                setSort={setSort}
                className="hidden w-24 lg:table-cell"
              >
                {t("columns.battles")}
              </OnslaughtSortHead>
              <OnslaughtSortHead
                col={DropoutSortCol.LeftAt}
                sort={sort}
                setSort={setSort}
                className="w-36"
              >
                {t("columns.left")}
              </OnslaughtSortHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row) => (
              <TableRow key={row.account_id}>
                <TableCell>
                  <PlayerName
                    region={region}
                    player={identityFromRow(row)}
                    href={ROUTES.PLAYER_ONSLAUGHT(region, row.nickname)}
                  />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  #{num(INT_FORMAT).format(row.bestRank)}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                  #{num(INT_FORMAT).format(row.lastRank)}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                  {num(INT_FORMAT).format(row.lastRating)}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums lg:table-cell">
                  {num(INT_FORMAT).format(row.battles)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  <RelativeTime date={new Date(row.lastSeenAt * 1000)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {pager.total > 0 && <TablePager pager={pager} />}
    </>
  );
}
