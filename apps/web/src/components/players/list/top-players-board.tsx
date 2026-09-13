"use client";

import { useLocale } from "@onruntime/translations/react";
import { useCallback, useMemo } from "react";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { TablePager, usePagination } from "@/components/table-pager";
import PAGINATION from "@/constants/pagination";
import { TopPlayersList } from "@/components/players/list/top-players-list";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import { RATING_METRIC_LABEL, type RatingMetric } from "@unicum.gg/shared";
import type { TopPlayerByLanguageResult } from "@/services/wargaming/wot/players/top/by-language";
import type { Region } from "@unicum.gg/wargaming";
import { FilterSubject } from "@/components/filter-subject";
import { useTranslation } from "@/hooks/use-translation";

/**
 * One metric's leaderboard, paginated client-side over the full ranking (up to
 * 1000) fetched server-side, and server-rendered at the page the route names. Uses the site-wide TablePager so it reads like
 * every other paginated table. One instance per metric, each CSS-gated by the
 * parent's `data-rating-col` wrapper. Carries its own filter section (search +
 * a min/max range over the loaded ranking).
 */
export function TopPlayersBoard({
  region,
  metric,
  results,
  page,
}: {
  region: Region;
  metric: RatingMetric;
  results: TopPlayerByLanguageResult[];
  /** The page this render is of, from the route's own `/page/[n]` segment. */
  page?: number;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/players/list/view");
  const searchFields = useCallback(
    (r: TopPlayerByLanguageResult) => [r.nickname, r.clan_tag],
    [],
  );
  const rangeCols = useMemo<RangeColumn<TopPlayerByLanguageResult>[]>(
    () => [
      { key: "rating", label: RATING_METRIC_LABEL[metric], value: (r) => r.wnx },
      { key: "battles", label: t("battles"), value: (r) => r.battles },
      {
        key: "winrate",
        label: "WR %",
        value: (r) => (r.winrate != null ? r.winrate * 100 : null),
      },
    ],
    [metric, t],
  );
  const { filtered, filters } = useLeaderboardFilter(results, {
    searchFields,
    rangeCols,
    initialRangeCol: "rating",
  });

  // The three metric boards (wn7/wn8/wnx) are mounted at once and share the one
  // `?page=`: they are three views of one ranking, so they mean the same page.
  const { paged, pager } = usePagination(filtered, PAGINATION.SIZE.LEADERBOARD, {
    initialPage: page,
    // Links rather than buttons, since a route serves every page they name. A
    // caller that hands no page has no `/page/[n]` of its own (the per-language
    // landings share this board), and a link there would be a crawl onto the
    // first page under a second address.
    crawlable: page !== undefined,
  });
  return (
    <>
      <div className="border-b border-fd-border px-4 py-2.5">
        <LeaderboardFilterBar filters={filters} searchNoun={FilterSubject.Players} />
      </div>
      <TopPlayersList
        locale={locale}
        region={region}
        results={paged}
        metric={metric}
        rankOffset={pager.firstShown - 1}
      />
      {pager.total > 0 && <TablePager pager={pager} />}
    </>
  );
}
