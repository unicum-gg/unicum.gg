"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerClansHistory } from "@/components/players/clans-history";
import { PlayerRatingChart } from "@/components/players/rating-chart";
import { PlayerStatsTable } from "@/components/players/stats-table";
import {
  StrongholdStatsTable,
  type StrongholdPeriods,
} from "@/components/players/stronghold-stats-table";
import { PlayerTabsNav } from "@/components/players/tabs-nav";
import {
  PlayerTab,
  playerTabHref,
  tabFromQuery,
} from "@/components/players/tabs";
import { TanksLiftDrag } from "@/components/players/tanks-lift-drag";
import { PlayerVehiclesTable } from "@/components/players/vehicles-table";
import { styles } from "@/lib/styles";
import type { StrongholdStats } from "@/services/players";
import type { Region } from "@/services/wargaming/wot";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type OverallData = {
  current: React.ComponentProps<typeof PlayerStatsTable>["current"];
  periods: React.ComponentProps<typeof PlayerStatsTable>["periods"];
  tanks: React.ComponentProps<typeof PlayerStatsTable>["tanks"];
  periodTanks: React.ComponentProps<typeof PlayerStatsTable>["periodTanks"];
  encyclopedia: React.ComponentProps<typeof PlayerStatsTable>["encyclopedia"];
  wn8Expected: React.ComponentProps<typeof PlayerStatsTable>["wn8Expected"];
  wnxExpected: React.ComponentProps<typeof PlayerStatsTable>["wnxExpected"];
  ratingData: React.ComponentProps<typeof PlayerRatingChart>["data"];
  metric: React.ComponentProps<typeof PlayerRatingChart>["metric"];
  metricLabel: string;
  clanHistory: React.ComponentProps<typeof PlayerClansHistory>["clanHistory"];
  createdAt: Date;
  nowMs: number;
};

type StrongholdData = { current: StrongholdStats | null; periods: StrongholdPeriods };

// The eight non-Overall tabs share one shape: a single stronghold-style table
// with a "no data yet" fallback. `label` fills both the panel title
// (`{nickname}'s {label} stats`) and the empty message (`No {label} data yet`).
const STRONGHOLD_TABS: {
  id: Exclude<PlayerTab, PlayerTab.Overall>;
  label: string;
}[] = [
  { id: PlayerTab.Skirmish, label: "skirmish" },
  { id: PlayerTab.Advances, label: "advances" },
  { id: PlayerTab.GrandBattles, label: "grand battles" },
  { id: PlayerTab.RankedBattles, label: "ranked battles" },
  { id: PlayerTab.ClanWarsX, label: "Clan Wars Tier X" },
  { id: PlayerTab.ClanWarsVIII, label: "Clan Wars Tier VIII" },
  { id: PlayerTab.ClanWarsVI, label: "Clan Wars Tier VI" },
  { id: PlayerTab.SteelHunter, label: "Steel Hunter" },
];

export type PlayerTabsViewProps = {
  region: Region;
  basePath: string;
  nickname: string;
  activeTab: PlayerTab;
  overall: OverallData;
  strongholds: Record<Exclude<PlayerTab, PlayerTab.Overall>, StrongholdData>;
};

export function PlayerTabsView({
  region,
  basePath,
  nickname,
  activeTab,
  overall,
  strongholds,
}: PlayerTabsViewProps) {
  // `activeTab` seeds the first client render so it matches the server HTML.
  // A tab click updates local state immediately (instant switch) and pushes
  // the URL. Back/forward instead moves through history, which Next reflects
  // in `useSearchParams`; we reconcile that during render (no effect) so the
  // shown tab follows the URL without a server round-trip.
  const searchParams = useSearchParams();
  const urlTab = tabFromQuery(searchParams.get("tab"));
  const [tab, setTab] = useState(activeTab);
  const [syncedUrlTab, setSyncedUrlTab] = useState(urlTab);
  if (urlTab !== syncedUrlTab) {
    setSyncedUrlTab(urlTab);
    setTab(urlTab);
  }

  function select(next: PlayerTab) {
    setTab(next);
    window.history.pushState(null, "", playerTabHref(basePath, next));
  }

  return (
    <>
      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <PlayerTabsNav
            basePath={basePath}
            activeTab={tab}
            onSelect={select}
          />
        </PanelHeader>
      </Panel>

      {tab === PlayerTab.Overall ? (
        <OverallTab region={region} nickname={nickname} {...overall} />
      ) : (
        <StrongholdTab
          nickname={nickname}
          label={
            STRONGHOLD_TABS.find((s) => s.id === tab)?.label ?? ""
          }
          data={strongholds[tab]}
        />
      )}
    </>
  );
}

function OverallTab({
  region,
  nickname,
  current,
  periods,
  tanks,
  periodTanks,
  encyclopedia,
  wn8Expected,
  wnxExpected,
  ratingData,
  metric,
  metricLabel,
  clanHistory,
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
            tanks={tanks}
            periodTanks={periodTanks}
            encyclopedia={encyclopedia}
            wn8Expected={wn8Expected}
            wnxExpected={wnxExpected}
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
              <div className="px-4 pb-4">
                <PlayerRatingChart
                  data={ratingData}
                  metricLabel={metricLabel}
                  metric={metric}
                />
              </div>
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
            tanks={tanks}
            encyclopedia={encyclopedia}
            wn8Expected={wn8Expected}
            wnxExpected={wnxExpected}
            metric={metric}
            metricLabel={metricLabel}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>
            {nickname}&apos;s tanks (
            {intFmt.format(tanks.filter((t) => t.all.battles > 0).length)})
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <PlayerVehiclesTable
            region={region}
            tanks={tanks}
            encyclopedia={encyclopedia}
            wn8Expected={wn8Expected}
            wnxExpected={wnxExpected}
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
    </>
  );
}

function StrongholdTab({
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
            <StrongholdStatsTable current={data.current} periods={data.periods} />
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
