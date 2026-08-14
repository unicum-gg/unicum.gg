"use client";

import { TablePager, usePagination } from "@/components/table-pager";
import { TopPlayersList } from "@/components/players/list/top-players-list";
import type { RatingMetric } from "@unicum.gg/shared";
import type { TopPlayerByLanguageResult } from "@/services/wargaming/wot/players/top/by-language";
import type { Region } from "@unicum.gg/wargaming";

/**
 * One metric's leaderboard, paginated client-side over the full ranking (up to
 * 1000) fetched server-side. Uses the site-wide TablePager so it reads like
 * every other paginated table. One instance per metric, each CSS-gated by the
 * parent's `data-rating-col` wrapper.
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
  // No URL sync: the three metric boards (wn7/wn8/wnx) are all mounted at once
  // and would otherwise fight over the shared `?page=`/`?ps=` params.
  const { paged, pager } = usePagination(results, 100, false);
  return (
    <>
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
