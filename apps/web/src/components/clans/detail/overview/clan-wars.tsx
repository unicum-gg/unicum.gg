"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TaggedTitle } from "@/components/clans/detail/tagged-title";
import { ClanWarsStatsTable } from "@/components/clans/detail/overview/clan-wars-stats";
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
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <TaggedTitle tag={tag} color={color}>
              clan wars stats
            </TaggedTitle>
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
              No Clan Wars data yet. Check back after the next clan refresh.
            </div>
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
