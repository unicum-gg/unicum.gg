"use client";

import {
  LeaderboardPeriod,
  LeaderboardPeriodSelect,
  useLeaderboardPeriod,
} from "@/components/home/leaderboard-period";
import { TopClans, type TopClansInitial } from "@/components/home/top-clans";
import { TopClansLeaderboardLink } from "@/components/home/top-clans-leaderboard-link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { RATING_METRICS, RatingMetric } from "@unicum.gg/core/constants/rating";
import type { Region } from "@unicum.gg/wargaming/region";

const RATING_COL: Record<RatingMetric, "wn7" | "wn8" | "wnx"> = {
  [RatingMetric.Wn7]: "wn7",
  [RatingMetric.Wn8]: "wn8",
  [RatingMetric.Wnx]: "wnx",
};

/**
 * Top clans panel. The lifetime ranking and the last-30-days "recent form"
 * ranking are both precomputed server-side and passed in; the title's inline
 * select toggles which one is shown, with no refetch. The period is shared (via
 * a cookie) with the "Top players" panel, so the two stay in sync. The "See all
 * →" link only applies to the all-time leaderboard.
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
  const [period, setPeriod] = useLeaderboardPeriod();
  const isOverall = period === LeaderboardPeriod.Overall;
  const data = isOverall ? overallByMetric : monthByMetric;

  return (
    <Panel className="flex flex-col">
      <PanelHeader className="flex items-center justify-between gap-3">
        <PanelTitle>
          Top clans ·{" "}
          <LeaderboardPeriodSelect period={period} onChange={setPeriod} />
        </PanelTitle>
        {isOverall && (
          <TopClansLeaderboardLink regionOverride={regionOverride} />
        )}
      </PanelHeader>
      <PanelContent className="flex-1 p-0">
        {RATING_METRICS.map((m, i) => (
          <div key={m} data-rating-col={RATING_COL[m]}>
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
