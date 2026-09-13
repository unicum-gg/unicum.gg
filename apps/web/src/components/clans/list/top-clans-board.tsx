"use client";

import { useLocale } from "@onruntime/translations/react";
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
import { FilterSubject } from "@/components/filter-subject";
import { useTranslation } from "@/hooks/use-translation";

/**
 * Rows per page. The ranking is fetched exactly this deep (`LIMIT` in the view),
 * so the board has one page and no route names a second: the controls below
 * only appear at all once a reader asks for fewer rows.
 */
const PAGE_SIZE = 100;

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
  const { locale } = useLocale();
  const { t } = useTranslation("components/clans/list/view");
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
      { key: "members", label: t("members"), value: (r) => r.members_count },
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
  const { paged, pager } = usePagination(filtered, PAGE_SIZE);
  return (
    <>
      <div className="border-b border-fd-border px-4 py-2.5">
        <LeaderboardFilterBar filters={filters} searchNoun={FilterSubject.Clans} />
      </div>
      <TopClansList
        locale={locale}
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
