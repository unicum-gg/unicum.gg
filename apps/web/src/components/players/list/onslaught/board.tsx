"use client";

import { useFormat } from "@/hooks/use-format";
import { useCallback, useMemo } from "react";
import Image from "next/image";
import { GlossaryLabel } from "@/components/glossary/label";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { OnslaughtBoardRow } from "@/components/players/list/onslaught/board-row";
import {
  type OnslaughtDropoutRow,
  OnslaughtDropoutsTable,
} from "@/components/players/list/onslaught/dropouts";
import {
  ACTIVITY_BUCKETS,
  ActivityBucket,
  activityBucket,
  activityReference,
  BoardView,
  compareBy,
  type OnslaughtRow,
  OnslaughtSortCol,
} from "@/components/players/list/onslaught/row";
import {
  OnslaughtSeasonSelect,
  type OnslaughtSeasonRef,
} from "@/components/players/list/onslaught/season-select";
import { OnslaughtSortHead } from "@/components/players/list/onslaught/sort-head";
import { SegmentedControl } from "@/components/segmented-control";
import { useOnslaughtBoardControls } from "@/components/players/list/onslaught/use-board-controls";
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
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  onslaughtRankIcon,
  onslaughtTier,
  OnslaughtTier,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { FilterSubject } from "@/components/filter-subject";
import { useTranslation } from "@/hooks/use-translation";
import { BattleType } from "@unicum.gg/shared";
import { battleTypeName } from "@/components/game-name";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;


const TIERS = [OnslaughtTier.Legend, OnslaughtTier.Champion] as const;

export type { OnslaughtRow };

export function OnslaughtBoard({
  region,
  results,
  dropouts,
  elitePosition,
  masterPosition,
  seasonOrdinal,
  assetsRef,
  seasons,
  currentSeasonId,
  page,
}: {
  region: Region;
  results: OnslaughtRow[];
  dropouts: OnslaughtDropoutRow[];
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
  const { filtered, filters } = useLeaderboardFilter(results, {
    searchFields,
    rangeCols,
    initialRangeCol: "rating",
    syncUrl: true,
  });

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
  const hasLost = dropouts.length > 0;
  const showLost = hasLost && view === BoardView.Lost;

  // The board's own newest capture, which is the clock the activity buckets
  // read rather than the reader's (see `activityReference`).
  const reference = useMemo(() => activityReference(results), [results]);
  // A season only carries rates if we recorded it. Nothing about activity is
  // shown for one we did not, since every player there would read as idle.
  const hasRates = reference > 0;

  // Rank + activity filters, then the client-side sort, over the searched set.
  const processed = useMemo(() => {
    let rows = filtered;
    if (tierSel.size > 0)
      rows = rows.filter((r) => {
        const t = onslaughtTier(r.rank, { elitePosition, masterPosition });
        return t != null && tierSel.has(t);
      });
    if (hasRates && activitySel.size > 0)
      rows = rows.filter((r) => activitySel.has(activityBucket(r, reference)));
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
    // Links rather than buttons, since a route serves every page they name. A
    // caller that hands no page has no `/page/[n]` of its own, and a link there
    // would be a crawl onto the first page under a second address.
    crawlable: page !== undefined,
  });

  // How many ranked players fall in each rank, for the chip labels.
  const tierCounts = useMemo(() => {
    const counts: Record<OnslaughtTier, number> = {
      [OnslaughtTier.Legend]: 0,
      [OnslaughtTier.Champion]: 0,
    };
    for (const r of results) {
      const t = onslaughtTier(r.rank, { elitePosition, masterPosition });
      if (t) counts[t] += 1;
    }
    return counts;
  }, [results, elitePosition, masterPosition]);

  const activityCounts = useMemo(() => {
    const counts: Record<ActivityBucket, number> = {
      [ActivityBucket.Today]: 0,
      [ActivityBucket.Week]: 0,
      [ActivityBucket.Idle]: 0,
    };
    if (!hasRates) return counts;
    for (const r of results) counts[activityBucket(r, reference)] += 1;
    return counts;
  }, [results, hasRates, reference]);

  const rankChips = (
    <ChipRow className="h-7">
      {TIERS.map((rank) => (
        <Chip
          key={rank}
          active={tierSel.has(rank)}
          onClick={() => toggleTier(rank)}
          className="flex h-full items-center py-0"
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
    <ChipRow className="h-7">
      {ACTIVITY_BUCKETS.map((bucket) => (
        <Chip
          key={bucket}
          active={activitySel.has(bucket)}
          onClick={() => toggleActivity(bucket)}
          className="flex h-full items-center py-0"
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
        <PanelTitle>{t("board", { count: results.length, mode })}</PanelTitle>
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
                  count: results.length,
                },
                {
                  id: BoardView.Lost,
                  label: tOwn("views.lost"),
                  count: dropouts.length,
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
            dropouts={dropouts}
            sort={lostSort}
            setSort={setLostSort}
          />
        ) : (
          <>
            {results.length > 0 && (
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
            {results.length === 0 ? (
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
                <TableBody>
                  {paged.map((r) => (
                    <OnslaughtBoardRow
                      key={r.account_id}
                      region={region}
                      row={r}
                      tier={onslaughtTier(r.rank, {
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
