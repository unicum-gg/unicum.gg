"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  StrongholdStatsTable,
  type StrongholdPeriods,
} from "@/components/players/detail/overview/stronghold-stats-table";
import { styles } from "@/lib/styles";
import type { StrongholdStats } from "@unicum.gg/shared";

export type StrongholdData = {
  current: StrongholdStats | null;
  periods: StrongholdPeriods;
};

/** The Overview section under any of the eight stronghold-style modes: a single
 * stronghold stats table, or a "no data yet" fallback. */
export function StrongholdTab({
  nickname,
  label,
  data,
}: {
  nickname: string;
  label: string;
  data: StrongholdData;
}) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {nickname}&apos;s {label} stats
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {data.current !== null ? (
            <StrongholdStatsTable
              current={data.current}
              periods={data.periods}
            />
          ) : (
            <div className={`p-4 ${styles.mutedDescription}`}>
              No {label} data yet. Check back after the next snapshot.
            </div>
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
