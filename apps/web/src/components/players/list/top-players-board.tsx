"use client";

import { useLocale } from "@onruntime/translations/react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { parsePage, TablePager, usePagination } from "@/components/table-pager";
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
import { unicum } from "@/services/sdk";
import { sharedParamStore } from "@/lib/url-param-store";

/**
 * One metric's leaderboard, server-rendered at the page the route names and
 * paged through the site-wide TablePager, so it reads like every other
 * paginated table. One instance, for the metric the reader is reading, which is
 * the default one unless `TopPlayersPanel` fetched another. Carries its own
 * filter section (search + a min/max range over the ranking).
 *
 * **Where the rows come from is the whole subject here.** With `serverTotal`
 * the server hands over ONE page and the pager navigates for the next, which is
 * what took the landing's navigation payload from 286 kB to 63: a thousand rows
 * were being shipped for the hundred on screen, five times over, once per
 * metric. The filter bar is what still wants the whole ranking, since narrowing
 * a hundred rows would answer about the page rather than about the board, so it
 * is fetched the moment a filter is actually used and not before. A reader who
 * only reads the board never pays for it, and one who searches pays once.
 */
export function TopPlayersBoard({
  region,
  metric,
  results,
  page,
  serverTotal,
  language = null,
  strict = false,
  recent = false,
}: {
  region: Region;
  metric: RatingMetric;
  results: TopPlayerByLanguageResult[];
  /** The page this render is of, from the route's own `/page/[n]` segment. */
  page?: number;
  /**
   * Rows the board holds in all, when `results` is one server-cut page of it.
   * Absent, `results` is the whole ranking and everything stays client-side,
   * which is what the per-language landings still want: they have no
   * `/page/[n]` route for a pager to navigate to.
   */
  serverTotal?: number;
  /** The language the board is filtered to, for the filter bar's own fetch. */
  language?: string | null;
  /** Whether that filter is the strict one, same reason. */
  strict?: boolean;
  /** Print the 30-day rating column, see `TopPlayersList`. */
  recent?: boolean;
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
  // Which page is wanted is read from the URL rather than from the pager
  // below, and that is not a shortcut: the pager is built FROM these rows, so
  // asking it which rows to fetch would be a cycle. The address bar is the one
  // place the answer exists before they arrive.
  const pageStore = sharedParamStore(PAGINATION.PARAM);
  const urlPage = useSyncExternalStore(
    pageStore.subscribe,
    pageStore.read,
    () => null,
  );
  const wanted = parsePage(urlPage) ?? page ?? 1;
  const size = PAGINATION.SIZE.LEADERBOARD;
  // One board is mounted now, the one the reader is reading, so a page click is
  // one request. It used to mount all five and let CSS show one, where a click
  // cost five, four of them for boards nobody was looking at.
  const sliced = serverTotal !== undefined;

  // The filter narrows the BOARD, not the page, so using it is what buys the
  // rest of the ranking. Armed by the filter going active rather than by a
  // keystroke, so clearing the box does not throw the rows away again.
  const [wantFull, setWantFull] = useState(false);

  // Both fetches ask the same board for a different slice of it, so the query
  // is built once: the language pair is what selects the ranking, and getting
  // it wrong would filter one of them against a different population.
  const scope = useCallback(
    (m: RatingMetric, take: number, skip: number) =>
      unicum
        .region(region)
        .players.top({
          metric: m,
          limit: take,
          ...(skip ? { offset: skip } : {}),
          ...(language ? { lang: language } : { languages: "true" as const }),
          ...(strict ? { strict: "true" as const } : {}),
        })
        .then((res) => res.results as unknown as TopPlayerByLanguageResult[]),
    [region, language, strict],
  );

  // The page the server rendered is in hand; any other is a fetch of a hundred
  // rows, which is what a page click costs now that the payload no longer
  // carries all ten of them.
  const { data: pageRows } = useSWR(
    sliced && !wantFull && wanted !== (page ?? 1)
      ? (["players-top-page", region, metric, wanted, language, strict] as const)
      : null,
    () => scope(metric, size, (wanted - 1) * size),
    { keepPreviousData: true, revalidateOnFocus: false },
  );
  const { data: full } = useSWR(
    wantFull && sliced
      ? (["players-top-full", region, metric, serverTotal, language, strict] as const)
      : null,
    () => scope(metric, serverTotal ?? size, 0),
    { keepPreviousData: true, revalidateOnFocus: false },
  );
  const source = full ?? (wanted !== (page ?? 1) ? (pageRows ?? results) : results);
  // Asked for and not yet here. Until it lands the rows are one page, so the
  // bar must not count over them and call it the ranking: a nickname ranked
  // past the first page read as absent for as long as the fetch took, and for
  // good when it failed.
  const pending = wantFull && !full;
  const { filtered, filters } = useLeaderboardFilter(source, {
    searchFields,
    rangeCols,
    initialRangeCol: "rating",
    // What it searches is the board, not the page in hand.
    total: serverTotal,
  });
  // Derived during the render that first sees a filter, not in an effect: an
  // effect would paint the page once with the narrowed rows before arming the
  // fetch, and the pager beside it reads the same way (`usePagination` adopts
  // a URL that moved under it exactly like this).
  if (filters.active && !wantFull) setWantFull(true);

  // `?page=` is read through the shared param store rather than held here, so
  // the board and the filter bar above it cannot disagree about which page is
  // on screen.
  const { paged, pager } = usePagination(filtered, PAGINATION.SIZE.LEADERBOARD, {
    initialPage: page,
    // Server-cut until the filter bar pulls the whole ranking in, after which
    // the rows really are all here and the pager slices them as it always did.
    serverTotal: wantFull ? undefined : serverTotal,
    // Links rather than buttons, since a route serves every page they name. A
    // caller that hands no page has no `/page/[n]` of its own (the per-language
    // landings share this board), and a link there would be a crawl onto the
    // first page under a second address.
    crawlable: page !== undefined,
  });
  return (
    <>
      <div className="border-b border-fd-border px-4 py-2.5">
        <LeaderboardFilterBar
          filters={filters}
          searchNoun={FilterSubject.Players}
          pending={pending}
        />
      </div>
      <div className={pending ? "opacity-60 transition-opacity" : undefined}>
        <TopPlayersList
          locale={locale}
          region={region}
          results={paged}
          metric={metric}
          rankOffset={pager.firstShown - 1}
          recent={recent}
          pending={pending}
        />
      </div>
      {pager.total > 0 && <TablePager pager={pager} />}
    </>
  );
}
