"use client";

import { Period, usePeriod } from "@/hooks/use-period";
import { useTranslation } from "@/hooks/use-translation";
import { PeriodSelect } from "@/components/home/period-select";
import { TopClans, type TopClansInitial } from "@/components/home/top-clans";
import { TopClansLeaderboardLink } from "@/components/home/top-clans-leaderboard-link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { RATING_METRICS } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Top clans panel. The lifetime ranking and the last-30-days "recent form"
 * ranking are both precomputed server-side and passed in; the title's inline
 * select toggles which one is shown, with no refetch. The period is shared (via
 * a cookie) with the "Top players" panel, so the two stay in sync. The "See all
 * →" link only applies to the all-time leaderboard.
 *
 * Both come in every metric, ordered as `RATING_METRICS`. PR and WTR have no
 * value over a window, so the 30-day board ranks on the current figure of who
 * was active in it (see `rankedByKey`).
 */
export function TopClansOverallPanel({
  overallByMetric,
  monthByMetric,
  regionOverride,
}: {
  overallByMetric: TopClansInitial[];
  monthByMetric: TopClansInitial[];
  regionOverride?: Region;
}) {
  const [period, setPeriod] = usePeriod();
  const { t } = useTranslation("components/home/top-clans-overall-panel");
  const isOverall = period === Period.Overall;
  const data = isOverall ? overallByMetric : monthByMetric;

  return (
    <Panel className="flex flex-col">
      <PanelHeader className="flex items-center justify-between gap-3">
        <PanelTitle>
          {t("title")}{" "}
          <PeriodSelect period={period} onChange={setPeriod} />
        </PanelTitle>
        {isOverall && (
          <TopClansLeaderboardLink regionOverride={regionOverride} />
        )}
      </PanelHeader>
      <PanelContent className="flex-1 p-0">
        {RATING_METRICS.map((m, i) => (
          <div key={m} data-rating-col={m}>
            <TopClans
              initial={data[i]}
              metric={m}
              period={period}
              regionOverride={regionOverride}
            />
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}
