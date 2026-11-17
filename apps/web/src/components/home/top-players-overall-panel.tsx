"use client";

import { Period, usePeriod } from "@/hooks/use-period";
import { useTranslation } from "@/hooks/use-translation";
import { PeriodSelect } from "@/components/home/period-select";
import {
  TopPlayers,
  type TopPlayersInitial,
} from "@/components/home/top-players";
import { TopPlayersLeaderboardLink } from "@/components/home/top-players-leaderboard-link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import type { RatingMetric } from "@unicum.gg/shared";
import { HomeWindow } from "@/components/home/ranked-by";
import type { Region } from "@unicum.gg/wargaming";

/**
 * The third top-players panel. Both the all-time and the last-30-days
 * leaderboards are precomputed server-side and passed in; the title's inline
 * select toggles which one is shown, with no refetch. The period is shared (via
 * a cookie) with the "Top clans" panel, so the two stay in sync. The "See all →"
 * link only applies to the all-time leaderboard.
 *
 * Both come in the default metric only, and the board fetches another one for
 * a reader who picked it (see `TopPlayers`). PR and WTR have no value over a
 * window, so the 30-day board ranks on the current figure of who was active in
 * it (see `rankedByKey`).
 */
export function TopPlayersOverallPanel({
  overall,
  month,
  initialMetric,
  regionOverride,
}: {
  overall: TopPlayersInitial;
  month: TopPlayersInitial;
  /** The metric the page's rows rank by, which is the default one. */
  initialMetric: RatingMetric;
  regionOverride?: Region;
}) {
  const [period, setPeriod] = usePeriod();
  const { t } = useTranslation("components/home/top-players-overall-panel");
  const isOverall = period === Period.Overall;

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
        <TopPlayers
          initial={isOverall ? overall : month}
          initialMetric={initialMetric}
          period={isOverall ? HomeWindow.Overall : HomeWindow.Month}
          regionOverride={regionOverride}
        />
      </PanelContent>
    </Panel>
  );
}
