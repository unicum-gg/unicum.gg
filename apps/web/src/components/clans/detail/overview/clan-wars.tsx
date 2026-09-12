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
import { StatsPeriodSelect } from "@/components/stats-period-select";
import { styles } from "@/lib/styles";
import type { ClanGlobalMapView } from "@unicum.gg/shared";

/** The Overview section under the Clan Wars mode: the Clan Wars stats table, or
 * a "no data yet" fallback. */
export function ClanWarsTab({
  tag,
  color,
  clanWars,
}: {
  tag: string;
  color: string;
  clanWars: ClanGlobalMapView;
}) {
  const { t } = useTranslation("components/clans/detail/overview/clan-wars");
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <TaggedTitle tag={tag} color={color}>
              {t("clan-wars-stats")}</TaggedTitle>
            {clanWars.latest && <StatsPeriodSelect />}
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {clanWars.latest ? (
            <ClanWarsStatsTable
              latest={clanWars.latest}
              periods={clanWars.periods}
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
