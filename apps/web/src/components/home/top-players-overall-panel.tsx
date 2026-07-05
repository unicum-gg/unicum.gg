"use client";

import { useState } from "react";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import {
  TopPlayers,
  type TopPlayersInitial,
} from "@/components/home/top-players";
import { TopPlayersLeaderboardLink } from "@/components/home/top-players-leaderboard-link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RATING_METRICS, RatingMetric } from "@unicum.gg/core/constants/rating";
import type { Region } from "@unicum.gg/wargaming/region";

const RATING_COL: Record<RatingMetric, "wn7" | "wn8" | "wnx"> = {
  [RatingMetric.Wn7]: "wn7",
  [RatingMetric.Wn8]: "wn8",
  [RatingMetric.Wnx]: "wnx",
};

enum Period {
  Overall = "overall",
  Month = "30d",
}
const PERIOD_LABEL: Record<Period, string> = {
  [Period.Overall]: "Overall",
  [Period.Month]: "Past 30 days",
};

/**
 * The third top-players panel. Both the all-time and the last-30-days
 * leaderboards are precomputed server-side and passed in; the title's inline
 * select toggles which one is shown, with no refetch. The "See all →" link only
 * applies to the all-time leaderboard.
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
  const [period, setPeriod] = useState<Period>(Period.Overall);
  const isOverall = period === Period.Overall;
  const data = isOverall ? overallByMetric : monthByMetric;

  return (
    <Panel className="flex flex-col" screenLines={false}>
      <PanelHeader
        screenLines={false}
        className="flex items-center justify-between gap-3"
      >
        <PanelTitle>
          Top players ·{" "}
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as Period)}
          >
            <SelectTrigger
              size="sm"
              aria-label="Leaderboard period"
              className="-my-1 inline-flex! h-7! gap-1 px-1.5! py-0! align-middle text-xl! font-semibold [&_svg]:size-4"
            >
              <SelectValue>{PERIOD_LABEL[period]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.values(Period).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
