"use client";

import { Interpolate } from "@/components/interpolate";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { Period, usePeriod } from "@/hooks/use-period";
import { useTranslation } from "@/hooks/use-translation";
import { PeriodSelect } from "@/components/home/period-select";
import {
  TopPlayers,
  type TopPlayersInitial,
} from "@/components/home/top-players";
import { TopPlayersLeaderboardLink } from "@/components/home/top-players-leaderboard-link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { RATING_METRICS } from "@unicum.gg/shared";
import { rankedByKey } from "@/components/home/ranked-by";
import type { Region } from "@unicum.gg/wargaming";

/**
 * The third top-players panel. Both the all-time and the last-30-days
 * leaderboards are precomputed server-side and passed in; the title's inline
 * select toggles which one is shown, with no refetch. The period is shared (via
 * a cookie) with the "Top clans" panel, so the two stay in sync. The "See all →"
 * link only applies to the all-time leaderboard.
 *
 * Both come in every metric, ordered as `RATING_METRICS`. PR and WTR have no
 * value over a window, so the 30-day board ranks on the current figure of who
 * was active in it (see `rankedByKey`).
 */
export function TopPlayersOverallPanel({
  overallByMetric,
  monthByMetric,
  regionOverride,
}: {
  overallByMetric: TopPlayersInitial[];
  monthByMetric: TopPlayersInitial[];
  regionOverride?: Region;
}) {
  const [period, setPeriod] = usePeriod();
  const { t } = useTranslation("components/home/top-players-overall-panel");
  const { t: tRanked } = useTranslation("components/home/ranked-by");
  const isOverall = period === Period.Overall;
  const data = isOverall ? overallByMetric : monthByMetric;

  return (
    <Panel className="flex flex-col" screenLines={false}>
      <PanelHeader
        screenLines={false}
        className="flex items-center justify-between gap-3"
      >
        <PanelTitle>
          {t("title")}{" "}
          <PeriodSelect period={period} onChange={setPeriod} />
        </PanelTitle>
        {isOverall && (
          <TopPlayersLeaderboardLink regionOverride={regionOverride} />
        )}
      </PanelHeader>
      <PanelContent className="flex-1 p-0">
        {RATING_METRICS.map((m, i) => (
          <div key={m} data-rating-col={m}>
            <TopPlayers
              description={
                <Interpolate
                  template={tRanked(isOverall ? "overall" : rankedByKey("month", m))}
                  values={{ metric: <RatingMetricInlineSelect /> }}
                />
              }
              initial={data[i]}
              metric={m}
              regionOverride={regionOverride}
            />
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}
