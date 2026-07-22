"use client";

import { MountOnVisible } from "@/components/mount-on-visible";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerClansHistory } from "@/components/players/detail/overview/clans-history";
import { PlayerNameHistory } from "@/components/players/detail/overview/name-history";
import { PlayerRatingChart } from "@/components/players/detail/overview/rating-chart";
import { PlayerStatsTable } from "@/components/players/detail/overview/stats-table";
import { TanksLiftDrag } from "@/components/players/detail/overview/tanks-lift-drag";
import { styles } from "@/lib/styles";
import type {
  LiftDrag,
  NameHistoryEntry,
  PeriodStats,
  PlayerClanHistoryFull,
  PlayerDerivedStats,
  Stats,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

export type OverallData = {
  current: Stats;
  periods: PeriodStats;
  derived: PlayerDerivedStats;
  liftDrag: LiftDrag | null;
  ratingData: React.ComponentProps<typeof PlayerRatingChart>["data"];
  metric: React.ComponentProps<typeof PlayerRatingChart>["metric"];
  metricLabel: string;
  clanHistory: PlayerClanHistoryFull;
  nameHistory: NameHistoryEntry[];
  createdAt: Date;
  nowMs: number;
};

/** The Overview section under the default Random Battles mode: lifetime stats,
 * the rating progression chart, the tanks lifting/dragging the rating, clan
 * history and (when present) name history. */
export function OverallTab({
  region,
  nickname,
  current,
  periods,
  derived,
  liftDrag,
  ratingData,
  metric,
  metricLabel,
  clanHistory,
  nameHistory,
  createdAt,
  nowMs,
}: OverallData & { region: Region; nickname: string }) {
  return (
    <>
      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{nickname}&apos;s random battles stats</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <PlayerStatsTable
            current={current}
            periods={periods}
            derived={derived}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>
            {nickname}&apos;s {metricLabel} progression
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {ratingData.length > 0 ? (
            <>
              <div className={`p-4 ${styles.mutedDescription}`}>
                Solid line is overall {metricLabel} (matches the Total column
                above), drifting slowly as new battles accumulate. Dashed line
                is per-session {metricLabel}, computed from the battles played
                since the previous snapshot. It shows hot and cold streaks. Line
                color follows the rating tier.
              </div>
              <MountOnVisible
                className="px-4 pb-4"
                placeholder={<div className="h-56 w-full" />}
              >
                <PlayerRatingChart
                  data={ratingData}
                  metricLabel={metricLabel}
                  metric={metric}
                />
              </MountOnVisible>
            </>
          ) : (
            <div className={`p-4 ${styles.mutedDescription}`}>
              Not enough history yet. We need at least one snapshot to draw the
              curve. Check back soon.
            </div>
          )}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Tanks shaping {nickname}&apos;s rating</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <TanksLiftDrag
            region={region}
            liftDrag={liftDrag}
            metric={metric}
            metricLabel={metricLabel}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayerClansHistory
        region={region}
        nickname={nickname}
        accountCreatedAt={createdAt}
        clanHistory={clanHistory}
        nowMs={nowMs}
      />

      {nameHistory.length > 0 && (
        <>
          <PanelSeparator />
          <PlayerNameHistory history={nameHistory} nickname={nickname} />
        </>
      )}
    </>
  );
}
