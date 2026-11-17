"use client";

import { Period, usePeriod } from "@/hooks/use-period";
import { useTranslation } from "@/hooks/use-translation";
import { PeriodSelect } from "@/components/home/period-select";
import { TopClans, type TopClansInitial } from "@/components/home/top-clans";
import { TopClansLeaderboardLink } from "@/components/home/top-clans-leaderboard-link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import type { RatingMetric } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Top clans panel. The lifetime ranking and the last-30-days "recent form"
 * ranking are both precomputed server-side and passed in; the title's inline
 * select toggles which one is shown, with no refetch. The period is shared (via
 * a cookie) with the "Top players" panel, so the two stay in sync. The "See all
 * →" link only applies to the all-time leaderboard.
 *
 * Both come in the default metric only, and the board fetches another one for
 * a reader who picked it (see `TopClans`). PR and WTR have no value over a
 * window, so the 30-day board ranks on the current figure of who was active in
 * it (see `rankedByKey`).
 */
export function TopClansOverallPanel({
  overall,
  month,
  initialMetric,
  regionOverride,
}: {
  overall: TopClansInitial;
  month: TopClansInitial;
  /** The metric the page's rows rank by, which is the default one. */
  initialMetric: RatingMetric;
  regionOverride?: Region;
}) {
  const [period, setPeriod] = usePeriod();
  const { t } = useTranslation("components/home/top-clans-overall-panel");
  const isOverall = period === Period.Overall;

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
        <TopClans
          initial={isOverall ? overall : month}
          initialMetric={initialMetric}
          period={period}
          regionOverride={regionOverride}
        />
      </PanelContent>
    </Panel>
  );
}
