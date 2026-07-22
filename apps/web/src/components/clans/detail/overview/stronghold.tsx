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

/** The Overview section under the Stronghold mode: the stronghold stats table,
 * or a "no data yet" fallback. */
export function StrongholdTab({
  tag,
  color,
  stronghold,
}: {
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
              latest={stronghold.latest}
              periods={stronghold.periods}
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
