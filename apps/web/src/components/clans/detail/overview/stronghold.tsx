"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TaggedTitle } from "@/components/clans/detail/tagged-title";
import { ClanStrongholdStatsTable } from "@/components/clans/detail/overview/stronghold-stats";
import { styles } from "@/lib/styles";
import type { ClanStrongholdView } from "@unicum.gg/shared";
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
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <TaggedTitle tag={tag} color={color}>
              stronghold stats
            </TaggedTitle>
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {stronghold.latest ? (
            <ClanStrongholdStatsTable
              region={region}
              latest={stronghold.latest}
              periods={stronghold.periods}
              sr={stronghold.sr}
              sr30d={stronghold.sr30d}
            />
          ) : (
            <div className={`p-4 ${styles.mutedDescription}`}>
              No stronghold data yet. Check back after the next clan refresh.
            </div>
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
