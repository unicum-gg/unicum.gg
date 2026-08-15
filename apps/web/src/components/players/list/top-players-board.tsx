"use client";

import { useCallback, useMemo } from "react";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { TablePager, usePagination } from "@/components/table-pager";
import { TopPlayersList } from "@/components/players/list/top-players-list";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import { RATING_METRIC_LABEL, type RatingMetric } from "@unicum.gg/shared";
import type { TopPlayerByLanguageResult } from "@/services/wargaming/wot/players/top/by-language";
import type { Region } from "@unicum.gg/wargaming";

/**
 * One metric's leaderboard, paginated client-side over the full ranking (up to
 * 1000) fetched server-side. Uses the site-wide TablePager so it reads like
 * every other paginated table. One instance per metric, each CSS-gated by the
 * parent's `data-rating-col` wrapper. Carries its own filter section (search +
 * a min/max range over the loaded ranking).
 */
export function TopPlayersBoard({
  region,
  metric,
  results,
}: {
  region: Region;
  metric: RatingMetric;
  results: TopPlayerByLanguageResult[];
}) {
  const searchFields = useCallback(
    (r: TopPlayerByLanguageResult) => [r.nickname, r.clan_tag],
    [],
  );
  const rangeCols = useMemo<RangeColumn<TopPlayerByLanguageResult>[]>(
    () => [
      { key: "rating", label: RATING_METRIC_LABEL[metric], value: (r) => r.wnx },
      { key: "battles", label: "Battles", value: (r) => r.battles },
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
        <LeaderboardFilterBar filters={filters} searchNoun="players" />
      </div>
      <TopPlayersList
        region={region}
        results={paged}
        metric={metric}
        rankOffset={pager.firstShown - 1}
      />
      {pager.total > 0 && <TablePager pager={pager} />}
    </>
  );
}
