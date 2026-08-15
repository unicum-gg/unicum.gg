"use client";

import { useCallback, useMemo } from "react";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { TopClansList } from "@/components/clans/list/top-clans-list";
import { TablePager, usePagination } from "@/components/table-pager";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import {
  type ClanBoard,
  RATING_METRIC_LABEL,
  type RatingMetric,
} from "@unicum.gg/shared";
import type { TopClanByLanguageResult } from "@/services/wargaming/wot/clans/top/by-language";
import type { Region } from "@unicum.gg/wargaming";

/**
 * One metric's clan leaderboard, paginated client-side over the full ranking
 * fetched server-side, with its own filter section (search + a min/max range
 * over the loaded ranking). Mirror of the players board so /clans and /players
 * read as siblings. One instance per metric, each CSS-gated by the parent's
 * `data-rating-col` wrapper.
 */
export function TopClansBoard({
  region,
  metric,
  results,
  omitBoard,
}: {
  region: Region;
  metric: RatingMetric;
  results: TopClanByLanguageResult[];
  omitBoard?: ClanBoard;
}) {
  const searchFields = useCallback(
    (r: TopClanByLanguageResult) => [r.tag, r.name],
    [],
  );
  const rangeCols = useMemo<RangeColumn<TopClanByLanguageResult>[]>(
    () => [
      {
        key: "rating",
        label: RATING_METRIC_LABEL[metric],
        value: (r) => r.avg_value,
      },
      { key: "members", label: "Members", value: (r) => r.members_count },
      {
        key: "winrate",
        label: "WR %",
        value: (r) => (r.winrate != null ? r.winrate * 100 : null),
      },
    ],
    [metric],
  );
  const { filtered, filters } = useLeaderboardFilter(results, {
    searchFields,
    rangeCols,
    initialRangeCol: "rating",
  });

  // No URL sync: the three metric boards (wn7/wn8/wnx) are all mounted at once
  // and would otherwise fight over the shared `?page=`/`?ps=` params.
  const { paged, pager } = usePagination(filtered, 100, false);
  return (
    <>
      <div className="border-b border-fd-border px-4 py-2.5">
        <LeaderboardFilterBar filters={filters} searchNoun="clans" />
      </div>
      <TopClansList
        region={region}
        results={paged}
        metric={metric}
        omitBoard={omitBoard}
        rankOffset={pager.firstShown - 1}
      />
      {pager.total > 0 && <TablePager pager={pager} />}
    </>
  );
}
