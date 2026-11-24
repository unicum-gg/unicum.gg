"use client";

import { useTranslation } from "@/hooks/use-translation";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TaggedTitle } from "@/components/clans/detail/tagged-title";
import { ClanStrongholdStatsTable } from "@/components/clans/detail/overview/stronghold-stats";
import { StatWindowPeriodSelect } from "@/components/stat-window/period-select";
import { StatWindowScope } from "@/hooks/use-stat-windows";
import {
  useClanWindowColumns,
  windowedPeriods,
} from "@/components/clans/detail/overview/use-clan-window-columns";
import { clanWindowHeads } from "@/components/clans/detail/overview/clan-window-heads";
import { styles } from "@/lib/styles";
import { StrongholdPeriod, type ClanStrongholdView } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** The Overview section under the Stronghold mode: the per-mode stronghold stats
 * table (or a "no data yet" fallback). Each mode section header links to its
 * regional leaderboard (see `ClanStrongholdStatsTable`), which is the internal
 * funnel from every indexed clan page to the stronghold boards. */
export function StrongholdTab({
  region,
  tag,
  color,
  stronghold,
}: {
  region: Region;
  tag: string;
  color: string;
  stronghold: ClanStrongholdView;
}) {
  const { t } = useTranslation("components/clans/detail/overview/stronghold");
  const columns = useClanWindowColumns(region, tag);
  // The Skirmish Rating comes from the regional board, which is measured over
  // the three default windows only: a column set to anything else dashes it.
  const slotPeriods = [StrongholdPeriod.Day, StrongholdPeriod.Week, StrongholdPeriod.Month] as const;
  const sr = { ...stronghold.sr };
  columns.forEach((c, i) => {
    if (c.custom) sr[slotPeriods[i]] = null;
  });
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <TaggedTitle tag={tag} color={color}>
              {t("stronghold-stats")}</TaggedTitle>
            {stronghold.latest && <StatWindowPeriodSelect scope={StatWindowScope.Clan} />}
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {stronghold.latest ? (
            <ClanStrongholdStatsTable
              region={region}
              latest={stronghold.latest}
              periods={windowedPeriods(columns, stronghold.periods, (w) => w.stronghold)}
              periodHeads={clanWindowHeads(columns)}
              sr={sr}
            />
          ) : (
            <div className={`p-4 ${styles.mutedDescription}`}>
              {t("no-stronghold-data-yet-check")}</div>
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
