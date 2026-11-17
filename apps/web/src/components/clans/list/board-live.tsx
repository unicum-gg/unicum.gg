"use client";

import useSWR from "swr";
import { TopClansBoard } from "@/components/clans/list/top-clans-board";
import { usePaintedRatingMetric } from "@/hooks/use-rating-metric";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";
import type { TopClanByLanguageResult } from "@/services/wargaming/wot/clans/top/by-language";
import type { RatingMetric } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** How deep the board goes, the page's own figure. */
const LIMIT = 100;

/**
 * The clan leaderboard's one board, plus the fetch that replaces it for a
 * reader who picked another rating metric.
 *
 * The landing rendered one board per metric and let CSS show one, which is what
 * a static page has to do when the pick lives in a cookie it may not read.
 * Measured on the EU landing, that put 14,383 nodes on a page showing 100 rows,
 * against 3,197 for the one board that is read, all of the difference hydrated
 * by every visitor to be hidden. So the page serves the default metric and this
 * swaps it, which costs the readers who chose another one request and everybody
 * else nothing.
 *
 * The pick is read off the painted document rather than the cookie, because the
 * cookie hook answers with the default on the render that builds the tree (see
 * `usePaintedRatingMetric`).
 */
export function ClansBoardLive({
  region,
  initial,
  initialMetric,
  language,
  strict,
}: {
  region: Region;
  /** The rows the page was built with, which are `initialMetric`'s. */
  initial: TopClanByLanguageResult[];
  initialMetric: RatingMetric;
  /** The landing's own filters, so a fetched board is the same board. */
  language: string | null;
  strict: boolean;
}) {
  const metric = usePaintedRatingMetric(initialMetric);
  const served = metric === initialMetric;

  const { data, isLoading } = useSWR(
    served ? null : (["clans-top", region, metric, language, strict] as const),
    ([, r, m, lang, s]) =>
      unicum
        .region(r)
        .clans.top({
          metric: m,
          limit: LIMIT,
          ...(lang ? { lang } : { languages: "true" as const }),
          ...(s ? { strict: "true" as const } : {}),
        })
        .then((res) => res.results as unknown as TopClanByLanguageResult[]),
    { keepPreviousData: true },
  );

  // The page's own rows until the fetched ones land, faded while they are in
  // flight: an empty table under a filled heading reads as a failure, where a
  // board that is about to be replaced reads as one that is loading.
  const rows = data ?? initial;
  const loading = !served && (isLoading || data === undefined);

  return (
    <div className={cn("transition-opacity", loading && "opacity-60")}>
      <TopClansBoard region={region} results={rows} metric={metric} />
    </div>
  );
}
