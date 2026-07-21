"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { MountOnVisible } from "@/components/mount-on-visible";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerClansHistory } from "@/components/players/clans-history";
import { PlayerNameHistory } from "@/components/players/name-history";
import { PlayerRatingChart } from "@/components/players/rating-chart";
import { PlayerStatsTable } from "@/components/players/stats-table";
import {
  StrongholdStatsTable,
  type StrongholdPeriods,
} from "@/components/players/stronghold-stats-table";
import {
  PlayerModeNav,
  PlayerSectionNav,
} from "@/components/players/tabs-nav";
import {
  PlayerMode,
  PlayerSection,
  modeFromQuery,
  playerModeHref,
  playerSectionHref,
  sectionFromQuery,
} from "@/components/players/tabs";
import { TanksLiftDrag } from "@/components/players/tanks-lift-drag";
import { ValueTab } from "@/components/players/value-tab";
import { PlayerTanksTable } from "@/components/players/tanks-table";
import {
  TableSkeleton,
  type SkeletonColumn,
} from "@/components/table-skeleton";
import { styles } from "@/lib/styles";
import { unicum } from "@/services/sdk";
import { type StrongholdStats, type PlayerDerivedStats, type PlayerDetailData, type LiftDrag, type PlayerTankRow, type NameHistoryEntry } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// Mirrors PlayerTanksTable's columns so the on-demand loading placeholder lines
// up with the real table: centered icon columns, a wide left-aligned name, then
// right-aligned numeric columns.
const TANKS_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-6", align: "center" }, // Nation
  { width: "w-6", align: "center" }, // Type
  { width: "w-6", align: "center" }, // Tier
  { width: "w-28" }, // Name
  { width: "w-6", align: "center" }, // Mastery
  { width: "w-8", align: "center" }, // Marks
  { width: "w-14", align: "right" }, // Battles
  { width: "w-12", align: "right" }, // Avg damage
  { width: "w-12", align: "right" }, // Avg XP
  { width: "w-12", align: "right" }, // Winrate
  { width: "w-14", align: "right" }, // Rating
];

type OverallData = {
  current: React.ComponentProps<typeof PlayerStatsTable>["current"];
  periods: React.ComponentProps<typeof PlayerStatsTable>["periods"];
  derived: PlayerDerivedStats;
  liftDrag: LiftDrag | null;
  ratingData: React.ComponentProps<typeof PlayerRatingChart>["data"];
  metric: React.ComponentProps<typeof PlayerRatingChart>["metric"];
  metricLabel: string;
  clanHistory: React.ComponentProps<typeof PlayerClansHistory>["clanHistory"];
  nameHistory: NameHistoryEntry[];
  createdAt: Date;
  nowMs: number;
};

type StrongholdData = { current: StrongholdStats | null; periods: StrongholdPeriods };

// The eight stronghold modes (every mode but Random Battles) share one shape:
// a single stronghold-style table with a "no data yet" fallback. `label` fills
// both the panel title (`{nickname}'s {label} stats`) and the empty message
// (`No {label} data yet`).
type StrongholdModeId = Exclude<PlayerMode, PlayerMode.Overall>;
const STRONGHOLD_MODES: {
  id: StrongholdModeId;
  label: string;
}[] = [
  { id: PlayerMode.Skirmish, label: "skirmish" },
  { id: PlayerMode.Advances, label: "advances" },
  { id: PlayerMode.GrandBattles, label: "grand battles" },
  { id: PlayerMode.RankedBattles, label: "ranked battles" },
  { id: PlayerMode.ClanWarsX, label: "Clan Wars Tier X" },
  { id: PlayerMode.ClanWarsVIII, label: "Clan Wars Tier VIII" },
  { id: PlayerMode.ClanWarsVI, label: "Clan Wars Tier VI" },
  { id: PlayerMode.SteelHunter, label: "Steel Hunter" },
];

export type PlayerTabsViewProps = {
  region: Region;
  basePath: string;
  nickname: string;
  activeSection: PlayerSection;
  activeMode: PlayerMode;
  metricLabel: string;
  nowMs: number;
  // Live player detail (SWR + LiveSync owned by the parent `PlayerProfile`, so
  // the header and these tabs share one stream and one source of truth).
  detail: PlayerDetailData;
  // Present only when Tanks is the section the server rendered, so its content
  // is in the initial HTML (SEO for `?section=tanks`); null otherwise, so the
  // section fetches on demand when first opened.
  initialTanks: PlayerTankRow[] | null;
};

export function PlayerTabsView({
  region,
  basePath,
  nickname,
  activeSection,
  activeMode,
  metricLabel,
  nowMs,
  detail,
  initialTanks,
}: PlayerTabsViewProps) {
  // `activeSection`/`activeMode` seed the first client render so it matches the
  // server HTML. A nav click updates local state immediately (instant switch)
  // and pushes the URL. Back/forward instead moves through history, which Next
  // reflects in `useSearchParams`; we reconcile both axes during render (no
  // effect) so the view follows the URL without a server round-trip.
  const searchParams = useSearchParams();
  const urlSection = sectionFromQuery(searchParams.get("section"));
  const urlMode = modeFromQuery(searchParams.get("tab"));
  const [section, setSection] = useState(activeSection);
  const [mode, setMode] = useState(activeMode);
  const [syncedSection, setSyncedSection] = useState(urlSection);
  const [syncedMode, setSyncedMode] = useState(urlMode);
  if (urlSection !== syncedSection || urlMode !== syncedMode) {
    setSyncedSection(urlSection);
    setSyncedMode(urlMode);
    setSection(urlSection);
    setMode(urlMode);
  }

  // The per-tank list lives on its own endpoint and is fetched on demand
  // through the SDK. SWR keys on the URL and only runs when the Tanks section is
  // active (null key = no request); when the server already rendered Tanks
  // (`initialTanks` seeds the cache), skip the on-mount revalidation.
  const tanksUrl = `/api/${region}/players/${encodeURIComponent(nickname)}/tanks`;
  const seededTanks = initialTanks != null;
  const { data: tanks } = useSWR(
    section === PlayerSection.Tanks ? tanksUrl : null,
    () =>
      unicum
        .region(region)
        .players(nickname)
        .tanks()
        .then((r) => r.tanks as unknown as PlayerTankRow[]),
    {
      fallbackData: initialTanks ?? undefined,
      revalidateOnMount: !seededTanks,
    },
  );

  function selectSection(next: PlayerSection) {
    setSection(next);
    window.history.pushState(null, "", playerSectionHref(basePath, next, mode));
  }
  function selectMode(next: PlayerMode) {
    setMode(next);
    setSection(PlayerSection.Overview);
    window.history.pushState(null, "", playerModeHref(basePath, next));
  }

  const overall: OverallData = {
    current: detail.current,
    periods: detail.periods,
    derived: detail.derived,
    liftDrag: detail.liftDrag,
    ratingData: detail.ratingHistory,
    metric: detail.metric,
    metricLabel,
    clanHistory: detail.clanHistory,
    nameHistory: detail.nameHistory,
    createdAt: detail.player.createdAt,
    nowMs,
  };
  const strongholds: Record<StrongholdModeId, StrongholdData> = {
    [PlayerMode.Skirmish]: detail.strongholds.skirmish,
    [PlayerMode.Advances]: detail.strongholds.fortified,
    [PlayerMode.GrandBattles]: detail.strongholds.epic,
    [PlayerMode.RankedBattles]: detail.strongholds.ranked,
    [PlayerMode.ClanWarsX]: detail.strongholds.cwAbsolute,
    [PlayerMode.ClanWarsVIII]: detail.strongholds.cwChampion,
    [PlayerMode.ClanWarsVI]: detail.strongholds.cwMiddle,
    [PlayerMode.SteelHunter]: detail.strongholds.fallout,
  };
  const onTanks = section === PlayerSection.Tanks;
  const onValue = section === PlayerSection.Value;
  const showModes = !onTanks && !onValue;

  return (
    <>
      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <PlayerSectionNav
            basePath={basePath}
            section={section}
            mode={mode}
            onSelect={selectSection}
          />
        </PanelHeader>
      </Panel>

      {/* The mode row is a sibling section under Overview, so it gets the same
          diagonal separator as the content sections below it. */}
      {showModes && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="px-0! py-0!" screenLines={false}>
              <PlayerModeNav
                basePath={basePath}
                mode={mode}
                onSelect={selectMode}
              />
            </PanelHeader>
          </Panel>
        </>
      )}

      {onValue ? (
        <ValueTab
          region={region}
          nickname={nickname}
          valuation={detail.valuation}
        />
      ) : onTanks ? (
        <TanksTab
          region={region}
          nickname={nickname}
          vehicles={tanks ?? []}
          loading={onTanks && !tanks}
        />
      ) : mode === PlayerMode.Overall ? (
        <OverallTab region={region} nickname={nickname} {...overall} />
      ) : (
        <StrongholdTab
          nickname={nickname}
          label={STRONGHOLD_MODES.find((s) => s.id === mode)?.label ?? ""}
          data={strongholds[mode]}
        />
      )}
    </>
  );
}

// Its own tab (not part of Overall) so the ~700-row table isn't server-rendered
// on the default page load, which was the dominant SSR cost. The rows load from
// a separate endpoint on demand when the tab is opened; a `?section=tanks`
// deep-link seeds them from the server render for SEO.
function TanksTab({
  region,
  nickname,
  vehicles,
  loading,
}: {
  region: Region;
  nickname: string;
  vehicles: PlayerTankRow[];
  loading: boolean;
}) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {nickname}&apos;s tanks
            {loading ? "" : ` (${intFmt.format(vehicles.length)})`}
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {loading ? (
            <TableSkeleton columns={TANKS_SKELETON_COLUMNS} rows={12} />
          ) : (
            <PlayerTanksTable region={region} vehicles={vehicles} />
          )}
        </PanelContent>
      </Panel>
    </>
  );
}

function OverallTab({
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
