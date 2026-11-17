"use client";

import { useFormat } from "@/hooks/use-format";
import { GlossaryLabel } from "@/components/glossary/label";
import { Interpolate } from "@/components/interpolate";
import { PlayerName } from "@/components/entity/player-name";
import { identityFromRow } from "@/components/entity/player-identity";
import { RankMedal } from "@/components/rank-medal";
import { RelativeTime } from "@/components/relative-time";
import { RATING_METRIC_LABEL, RatingMetric, ratingColorClass } from "@unicum.gg/shared";
import PAGINATION from "@/constants/pagination";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { usePaintedRatingMetric } from "@/hooks/use-rating-metric";
import { useTranslation } from "@/hooks/use-translation";
import useSWR from "swr";
import { HomeWindow, homeRankedByKey } from "@/components/home/ranked-by";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { unicum } from "@/services/sdk";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { TopPlayerResult } from "@unicum.gg/core/wargaming/wot/players/top";
import { isRegion, Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

export type TopPlayersInitial = Record<
  Region,
  { results: TopPlayerResult[]; computedAt: Date | null }
>;

/**
 * One of the home page's player boards: nine rows of whoever leads the window.
 *
 * The home rendered this once per rating metric and let CSS show one, which is
 * what a static page has to do when the pick lives in a cookie. Measured on the
 * French home, that put 4,068 of its 6,002 DOM nodes in boards nobody can see,
 * and cost the server thirty leaderboard reads a render to publish six. So the
 * page serves the default metric and the board asks for another one when the
 * document says the reader picked it.
 *
 * It writes its own `ranked-by` line rather than taking one, because the metric
 * is decided here: a line built by the caller would have to be built five times
 * over, for the four nobody reads.
 */
export function TopPlayers({
  initial,
  initialMetric,
  period,
  regionOverride,
}: {
  initial: TopPlayersInitial;
  /** The metric the page's rows rank by, which is the default one. */
  initialMetric: RatingMetric;
  /** The window these rows cover, which is also what a fetch asks for. */
  period: HomeWindow;
  regionOverride?: Region;
}) {
  const [storedRegion] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  const { t } = useTranslation("components/home/top-players");
  const { t: tRanked } = useTranslation("components/home/ranked-by");
  const region: Region =
    regionOverride ?? (isRegion(storedRegion) ? storedRegion : Region.EU);
  const metric = usePaintedRatingMetric(initialMetric);
  const metricLabel = RATING_METRIC_LABEL[metric];

  const { data } = useSWR(
    metric === initialMetric
      ? null
      : (["home-top-players", region, metric, period] as const),
    ([, r, m, p]) =>
      unicum
        .region(r)
        .players.top({ metric: m, period: p, limit: PAGINATION.SIZE.PREVIEW })
        .then((res) => ({
          results: res.results,
          computedAt: res.computed_at ? new Date(res.computed_at) : null,
        })),
    { keepPreviousData: true },
  );

  // The page's own rows until the fetched ones land, which is the same trade
  // the leaderboard panels make: nine rows about to be replaced read better
  // than an empty panel.
  const { results, computedAt } = (data ??
    initial[region]) as TopPlayersInitial[Region];
  const description = (
    <Interpolate
      template={tRanked(homeRankedByKey(period, metric))}
      values={{ metric: <RatingMetricInlineSelect /> }}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        {description}
        {computedAt ? (
          <>
            {" "}
            <Interpolate
              template={t("updated")}
              values={{ when: <RelativeTime date={computedAt} /> }}
            />
          </>
        ) : null}
      </div>
      {results.length === 0 ? (
        <div className="mt-auto border-t border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="mt-auto">
          <Table className="mb-px! table-fixed [&_td]:min-w-0 [&_tr]:h-11">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 whitespace-nowrap px-4! text-center!">
                  {t("rank")}
                </TableHead>
                <TableHead>{t("player")}</TableHead>
                <TableHead className="w-24 pr-4 text-right!">
                  <GlossaryLabel label={metricLabel}>{metricLabel}</GlossaryLabel>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.slice(0, PAGINATION.SIZE.PREVIEW).map((p, i) => (
                <PlayerRow
                  key={p.account_id}
                  player={p}
                  rank={i + 1}
                  region={region}
                  metric={metric}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  rank,
  region,
  metric,
}: {
  player: TopPlayerResult;
  rank: number;
  region: Region;
  metric: RatingMetric;
}) {
  const { num } = useFormat();
  const colorClass = ratingColorClass(metric, player.wnx);
  return (
    <TableRow>
      <TableCell className="px-2! text-center font-mono tabular-nums text-muted-foreground">
        {rank === 1 || rank === 2 || rank === 3 ? (
          <RankMedal rank={rank} className="mx-auto" />
        ) : (
          rank
        )}
      </TableCell>
      <TableCell>
        <PlayerName region={region} player={identityFromRow(player)} />
      </TableCell>
      <TableCell
        className={cn("pr-4 text-right font-semibold tabular-nums", colorClass)}
      >
        {num(INT_FORMAT).format(player.wnx)}
      </TableCell>
    </TableRow>
  );
}
