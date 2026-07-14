"use client";

import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import {
  LeaderboardPeriod,
  LeaderboardPeriodSelect,
  useLeaderboardPeriod,
} from "@/components/home/leaderboard-period";
import {
  TopPlayers,
  type TopPlayersInitial,
} from "@/components/home/top-players";
import { TopPlayersLeaderboardLink } from "@/components/home/top-players-leaderboard-link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { RATING_METRICS, RatingMetric } from "@unicum.gg/core/constants/rating";
import type { Region } from "@unicum.gg/wargaming";

const RATING_COL: Record<RatingMetric, "wn7" | "wn8" | "wnx"> = {
  [RatingMetric.Wn7]: "wn7",
  [RatingMetric.Wn8]: "wn8",
  [RatingMetric.Wnx]: "wnx",
};

/**
 * The third top-players panel. Both the all-time and the last-30-days
 * leaderboards are precomputed server-side and passed in; the title's inline
 * select toggles which one is shown, with no refetch. The period is shared (via
 * a cookie) with the "Top clans" panel, so the two stay in sync. The "See all →"
 * link only applies to the all-time leaderboard.
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
  const [period, setPeriod] = useLeaderboardPeriod();
  const isOverall = period === LeaderboardPeriod.Overall;
  const data = isOverall ? overallByMetric : monthByMetric;

  return (
    <Panel className="flex flex-col" screenLines={false}>
      <PanelHeader
        screenLines={false}
        className="flex items-center justify-between gap-3"
      >
        <PanelTitle>
          Top players ·{" "}
          <LeaderboardPeriodSelect period={period} onChange={setPeriod} />
        </PanelTitle>
        {isOverall && (
          <TopPlayersLeaderboardLink regionOverride={regionOverride} />
        )}
      </PanelHeader>
      <PanelContent className="flex-1 p-0">
        {RATING_METRICS.map((m, i) => (
          <div key={m} data-rating-col={RATING_COL[m]}>
            <TopPlayers
              description={
                isOverall ? (
                  <>
                    Ranked by all-time <RatingMetricInlineSelect /> (min. 20,000
                    battles).
                  </>
                ) : (
                  <>
                    Ranked by <RatingMetricInlineSelect /> over the past 30 days
                    (min. 600 battles).
                  </>
                )
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
