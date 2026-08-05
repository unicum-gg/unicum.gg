"use client";

import dynamic from "next/dynamic";
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
import { PlayerStatsTable } from "@/components/players/detail/overview/stats-table";
import { TanksLiftDrag } from "@/components/players/detail/overview/tanks-lift-drag";
import { styles } from "@/lib/styles";
import type {
  LiftDrag,
  NameHistoryEntry,
  PeriodStats,
  PlayerClanHistoryFull,
  PlayerDerivedStats,
  RatingHistoryPoint,
  RatingMetric,
  Stats,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

// recharts is the heaviest dependency in the client bundle (107 KB gzipped,
// 372 KB parsed) and this chart is the only thing on the profile that draws
// one, so a static import made every view pay for it: Tanks, Value and the
// eight stronghold modes download it to render no chart at all. `next/dynamic`
// moves it to a chunk fetched when the chart actually mounts, which
// `MountOnVisible` below already defers until it scrolls near the viewport.
// `ssr: false` is the part that removes it from the initial graph (a
// server-rendered lazy component still has to download its chunk to hydrate);
// nothing is lost, since `MountOnVisible` renders a placeholder on the server
// anyway and a chart carries no indexable text.
const PlayerRatingChart = dynamic(
  () =>
    import("@/components/players/detail/overview/rating-chart").then(
      (m) => m.PlayerRatingChart,
    ),
  { ssr: false, loading: () => <div className="h-56 w-full" /> },
);

export type OverallData = {
  current: Stats;
  periods: PeriodStats;
  derived: PlayerDerivedStats;
  liftDrag: LiftDrag | null;
  ratingData: RatingHistoryPoint[];
  metric: RatingMetric;
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
