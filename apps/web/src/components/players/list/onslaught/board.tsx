"use client";

import { useFormat } from "@/hooks/use-format";
import { useCallback, useMemo } from "react";
import Image from "next/image";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { OnslaughtBoardRow } from "@/components/players/list/onslaught/board-row";
import {
  type OnslaughtDropoutRow,
  OnslaughtDropoutsTable,
} from "@/components/players/list/onslaught/dropouts";
import {
  BoardView,
  compareBy,
  type OnslaughtRow,
  OnslaughtSortCol,
  SortDirection,
} from "@/components/players/list/onslaught/row";
import {
  OnslaughtSeasonSelect,
  type OnslaughtSeasonRef,
} from "@/components/players/list/onslaught/season-select";
import { OnslaughtBoardHead } from "@/components/players/list/onslaught/board-head";
import { SegmentedControl } from "@/components/segmented-control";
import { useOnslaughtBoardControls } from "@/components/players/list/onslaught/use-board-controls";
import { useOnslaughtBoardRows } from "@/components/players/list/onslaught/use-board-rows";
import { Chip, ChipRow } from "@/components/ui/chip";
import { TablePager, usePagination } from "@/components/table-pager";
import PAGINATION from "@/constants/pagination";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { Table, TableBody } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ONSLAUGHT_ACTIVITY_BUCKETS,
  onslaughtActivityBucket,
  onslaughtBoardRank,
  onslaughtRankIcon,
  OnslaughtRank,
  type OnslaughtAggregates,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { FilterSubject } from "@/components/filter-subject";
import { useTranslation } from "@/hooks/use-translation";
import { BattleType } from "@unicum.gg/shared";
import { battleTypeName } from "@/components/game-name";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;


const TIERS = [OnslaughtRank.Legend, OnslaughtRank.Champion] as const;

export type { OnslaughtRow };

/**
 * **Where the rows come from is the whole subject here.** The server hands over
 * ONE page of the standings and the pager navigates for the next, which is what
 * took this page from 3,996,734 octets to a fraction of it: three thousand rows
 * were shipped so that a browser could draw a hundred, average them for the
 * panels below, and hold the rest against a search box.
 *
 * The panels read `aggregates` now, so every count and median on screen is
 * still the whole board's. What genuinely wants the rows is the reader's own
 * narrowing (a search, a sort, a chip, the lost-place tab), since narrowing a
 * hundred rows would answer about the page rather than about the board, so the
 * rest is fetched the moment one of those is used and not before. A reader who
 * only reads the board never pays for it, and one who searches pays once.
 */
export function OnslaughtBoard({
  region,
  results,
  dropouts,
  aggregates,
  lost,
  seasonId,
  elitePosition,
  masterPosition,
  seasonOrdinal,
  assetsRef,
  seasons,
  currentSeasonId,
  page,
}: {
  region: Region;
  /** One page of the standings, in rank order. */
  results: OnslaughtRow[];
  /** One page of the lost places, newest first. */
  dropouts: OnslaughtDropoutRow[];
  /** What the whole board says about itself: every count, median and threshold
   * on this page, computed server-side over every ranked row. */
  aggregates: OnslaughtAggregates;
  /** How many lost their place in all, for the tab beside the standings. */
  lost: number;
  /** The season these rows are of, so a page fetch cannot land on another one
   * if the current season rolls over after this page was prerendered. */
  seasonId: string | null;
  elitePosition: number | null;
  masterPosition: number | null;
  seasonOrdinal: string | null;
  assetsRef: string | null;
  seasons: OnslaughtSeasonRef[];
  currentSeasonId: string | null;
  /** The page this render is of, from the route's own `/page/[n]` segment. */
  page?: number;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/list/onslaught/view");
  const { t: tOwn } = useTranslation("components/players/list/onslaught/board");
  const { t: tGame } = useTranslation("game/vocabulary");
  const mode = battleTypeName(BattleType.Onslaught, tGame);
  // Filter over the fully-loaded standings: search matches the current AND
  // recorded nickname/clan (findable by who they are now or the name they held
  // when ranked), plus a min/max range on Battles or Rating Points.
  const searchFields = useCallback(
    (r: OnslaughtRow) => [
      r.nickname,
      r.recordedNickname,
      r.clan_tag,
      r.recordedClanTag,
    ],
    [],
  );
  const rangeCols = useMemo<RangeColumn<OnslaughtRow>[]>(
    () => [
      { key: "rating", label: t("columns.rating"), value: (r) => r.rating },
      { key: "battles", label: t("columns.battles"), value: (r) => r.battles },
    ],
    [t],
  );
  const {
    view,
    setView,
    sort,
    setSort,
    lostSort,
    setLostSort,
    tiers: tierSel,
    toggleTier,
    activity: activitySel,
    toggleActivity,
  } = useOnslaughtBoardControls();
  // A season we hold no captures of has nobody to have lost a place, so the
  // second tab is absent rather than empty, and a `?view=lost` link to such a
  // season falls back to the standings instead of an empty table.
  const hasLost = lost > 0;
  const showLost = hasLost && view === BoardView.Lost;

  // Every control that narrows or reorders the BOARD rather than the page, which
  // is what buys the rest of the rows. The default sort is the rank order the
  // server already served, so arriving on the board asks for nothing. Opening
  // the lost-place tab counts: that table carries its own search, sort and
  // pager over a list the server also only sent a page of.
  const narrowing =
    sort.col !== OnslaughtSortCol.Rating ||
    sort.dir !== SortDirection.Desc ||
    tierSel.size > 0 ||
    activitySel.size > 0 ||
    showLost;
  const { source, lostRows, serverTotal, wantFull, requestFull } =
    useOnslaughtBoardRows({
      region,
      seasonId,
      results,
      dropouts,
      ranked: aggregates.ranked,
      page,
      narrowing,
    });

  const { filtered, filters } = useLeaderboardFilter(source, {
    searchFields,
    rangeCols,
    initialRangeCol: "rating",
    syncUrl: true,
    // What it searches is the board, not the page in hand.
    total: aggregates.ranked,
  });
  // Derived during the render that first sees a filter, not in an effect: an
  // effect would paint the page once with the narrowed rows before arming the
  // fetch, and the pager beside it reads the same way.
  if (filters.active && !wantFull) requestFull();

  // The board's own newest capture, which is the clock the activity buckets
  // read rather than the reader's (see `onslaughtActivityReference`). Taken off
  // the aggregates, since a page of rows would date the board by whoever on it
  // played most recently.
  const reference = aggregates.reference;
  // A season only carries rates if we recorded it. Nothing about activity is
  // shown for one we did not, since every player there would read as idle.
  const hasRates = reference > 0;

  // Rank + activity filters, then the client-side sort, over the searched set.
  const processed = useMemo(() => {
    let rows = filtered;
    if (tierSel.size > 0)
      rows = rows.filter((r) => {
        const t = onslaughtBoardRank(r.rank, { elitePosition, masterPosition });
        return t != null && tierSel.has(t);
      });
    if (hasRates && activitySel.size > 0)
      rows = rows.filter((r) =>
        activitySel.has(onslaughtActivityBucket(r, reference)),
      );
    return [...rows].sort(compareBy(sort.col, sort.dir));
  }, [
    filtered,
    tierSel,
    activitySel,
    hasRates,
    reference,
    sort,
    elitePosition,
    masterPosition,
  ]);

  const { paged, pager } = usePagination(processed, PAGINATION.SIZE.LEADERBOARD, {
    initialPage: page,
    serverTotal,
    // Links rather than buttons, since a route serves every page they name. A
    // caller that hands no page has no `/page/[n]` of its own, and a link there
    // would be a crawl onto the first page under a second address.
    crawlable: page !== undefined,
  });

  // How many ranked players fall in each rank and each activity bucket, for the
  // chip labels. Folded server-side over the whole board: counted here, they
  // would count the page and a chip would promise rows it cannot name.
  const tierCounts = aggregates.tiers;
  const activityCounts = aggregates.activity;

  const rankChips = (
    <ChipRow>
      {TIERS.map((rank) => (
        <Chip
          key={rank}
          active={tierSel.has(rank)}
          onClick={() => toggleTier(rank)}
        >
          <span className="inline-flex items-center gap-1.5">
            <Image
              src={onslaughtRankIcon(rank, seasonOrdinal, assetsRef)}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4"
            />
            {tGame(`onslaught-tiers.${rank}`)}
            <span className="text-fd-muted-foreground/70 tabular-nums">
              ({num(INT_FORMAT).format(tierCounts[rank])})
            </span>
          </span>
        </Chip>
      ))}
    </ChipRow>
  );

  // Absent rather than inert on a season with no captures behind it, like the
  // Common Test chip on the tanks catalogue.
  const activityChips = hasRates ? (
    <ChipRow>
      {ONSLAUGHT_ACTIVITY_BUCKETS.map((bucket) => (
        <Chip
          key={bucket}
          active={activitySel.has(bucket)}
          onClick={() => toggleActivity(bucket)}
        >
          <span className="inline-flex items-center gap-1.5">
            {tOwn(`activity.${bucket}`)}
            <span className="text-fd-muted-foreground/70 tabular-nums">
              ({num(INT_FORMAT).format(activityCounts[bucket])})
            </span>
          </span>
        </Chip>
      ))}
    </ChipRow>
  ) : null;

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>
            {t("board", { count: aggregates.ranked, mode })}
          </PanelTitle>
        <div className="flex flex-wrap items-center gap-2">
          <OnslaughtSeasonSelect
            seasons={seasons}
            current={currentSeasonId}
            region={region}
          />
          {/* One table on screen at a time. The standings and the places that
              were lost are the same question in two tenses, and stacking two
              tables down the page asks the reader to scan twice. The site's own
              segmented switch, beside the season the way the language boards
              put Any/Strict beside the language. */}
          {hasLost && (
            <SegmentedControl
              active={view}
              onSelect={setView}
              segments={[
                {
                  id: BoardView.Ranked,
                  label: tOwn("views.ranked"),
                  count: aggregates.ranked,
                },
                {
                  id: BoardView.Lost,
                  label: tOwn("views.lost"),
                  count: lost,
                },
              ]}
            />
          )}
        </div>
      </PanelHeader>
      <PanelContent className="p-0">
        {showLost ? (
          <OnslaughtDropoutsTable
            region={region}
            dropouts={lostRows}
            sort={lostSort}
            setSort={setLostSort}
          />
        ) : (
          <>
            {aggregates.ranked > 0 && (
              <div className="border-b border-fd-border px-4 py-2.5">
                <LeaderboardFilterBar
                  filters={filters}
                  searchNoun={FilterSubject.Players}
                  extra={
                    <>
                      {rankChips}
                      {activityChips}
                    </>
                  }
                />
              </div>
            )}
            {aggregates.ranked === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                {tOwn("no-onslaught-standings-yet")}
              </div>
            ) : processed.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                {tOwn("no-player-matches-the-current")}
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
                <OnslaughtBoardHead sort={sort} setSort={setSort} />
                <TableBody>
                  {paged.map((r) => (
                    <OnslaughtBoardRow
                      key={r.account_id}
                      region={region}
                      row={r}
                      tier={onslaughtBoardRank(r.rank, {
                        elitePosition,
                        masterPosition,
                      })}
                      seasonOrdinal={seasonOrdinal}
                      assetsRef={assetsRef}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
            {pager.total > 0 && <TablePager pager={pager} />}
          </>
        )}
      </PanelContent>
    </Panel>
  );
}
