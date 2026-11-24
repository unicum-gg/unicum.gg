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
import { ClanWarsStatsTable } from "@/components/clans/detail/overview/clan-wars-stats";
import { StatWindowPeriodSelect } from "@/components/stat-window/period-select";
import { StatWindowScope } from "@/hooks/use-stat-windows";
import {
  useClanWindowColumns,
  windowedPeriods,
} from "@/components/clans/detail/overview/use-clan-window-columns";
import { clanWindowHeads } from "@/components/clans/detail/overview/clan-window-heads";
import { styles } from "@/lib/styles";
import type { ClanGlobalMapView } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** The Overview section under the Clan Wars mode: the Clan Wars stats table, or
 * a "no data yet" fallback. */
export function ClanWarsTab({
  region,
  tag,
  color,
  clanWars,
}: {
  region: Region;
  tag: string;
  color: string;
  clanWars: ClanGlobalMapView;
}) {
  const { t } = useTranslation("components/clans/detail/overview/clan-wars");
  const columns = useClanWindowColumns(region, tag);
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <TaggedTitle tag={tag} color={color}>
              {t("clan-wars-stats")}</TaggedTitle>
            {clanWars.latest && <StatWindowPeriodSelect scope={StatWindowScope.Clan} />}
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {clanWars.latest ? (
            <ClanWarsStatsTable
              latest={clanWars.latest}
              periods={windowedPeriods(columns, clanWars.periods, (w) => w.globalMap)}
              periodHeads={clanWindowHeads(columns)}
            />
          ) : (
            <div className={`p-4 ${styles.mutedDescription}`}>
              {t("no-clan-wars-data-yet")}</div>
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
