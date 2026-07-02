"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { LiveSync } from "@/components/live-sync";
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
import { PlayerVehiclesTable } from "@/components/players/vehicles-table";
import { styles } from "@/lib/styles";
import type { StrongholdStats } from "@/services/players";
import type { PlayerDerivedStats } from "@/services/players/derived-stats";
import type { PlayerDetailData } from "@/services/players/detail";
import type { LiftDrag } from "@/services/players/lift-drag";
import type { PlayerVehicleRow } from "@/services/players/vehicles";
import { PlayerDetailResponse } from "@/services/openapi/schemas";
import type { Region } from "@/services/wargaming/wot";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type OverallData = {
  current: React.ComponentProps<typeof PlayerStatsTable>["current"];
  periods: React.ComponentProps<typeof PlayerStatsTable>["periods"];
  derived: PlayerDerivedStats;
  liftDrag: LiftDrag | null;
  ratingData: React.ComponentProps<typeof PlayerRatingChart>["data"];
  metric: React.ComponentProps<typeof PlayerRatingChart>["metric"];
  metricLabel: string;
  clanHistory: React.ComponentProps<typeof PlayerClansHistory>["clanHistory"];
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

// Parse the player detail response with the shared OpenAPI schema: it
// validates the shape and `z.coerce.date()` revives ISO date strings into
// `Date`s. The cast restores the rich domain types the components expect (the
// schema is intentionally `.loose()`).
async function playerDetailFetcher(url: string): Promise<PlayerDetailData> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return PlayerDetailResponse.parse(
    await res.json(),
  ) as unknown as PlayerDetailData;
}

export type PlayerTabsViewProps = {
  region: Region;
  basePath: string;
  nickname: string;
  activeSection: PlayerSection;
  activeMode: PlayerMode;
  metricLabel: string;
  nowMs: number;
  // Full player detail, seeded from the SSR render and kept live by SWR (see
  // the LiveSync wiring below).
  initialData: PlayerDetailData;
};

export function PlayerTabsView({
  region,
  basePath,
  nickname,
  activeSection,
  activeMode,
  metricLabel,
  nowMs,
  initialData,
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

  function selectSection(next: PlayerSection) {
    setSection(next);
    window.history.pushState(null, "", playerSectionHref(basePath, next, mode));
  }
  function selectMode(next: PlayerMode) {
    setMode(next);
    setSection(PlayerSection.Overview);
    window.history.pushState(null, "", playerModeHref(basePath, next));
  }

  // The page data lives behind SWR so a LiveSync tick refetches just this
  // JSON and re-renders client-side, instead of `router.refresh()`
  // re-rendering the whole route on the server. `initialData` seeds it from
  // the SSR render, so there's no fetch on load; only `mutateData()` (below)
  // triggers a refetch. Keyed by the SSR-resolved metric so lift/drag and the
  // rating history stay consistent with what the server rendered.
  const dataUrl = `/api/${region}/players/${encodeURIComponent(nickname)}?metric=${initialData.metric}`;
  const { data: liveData, mutate: mutateData } = useSWR(
    dataUrl,
    playerDetailFetcher,
    { fallbackData: initialData, revalidateOnMount: false },
  );
  const detail = liveData ?? initialData;

  const overall: OverallData = {
    current: detail.current,
    periods: detail.periods,
    derived: detail.derived,
    liftDrag: detail.liftDrag,
    ratingData: detail.ratingHistory,
    metric: detail.metric,
    metricLabel,
    clanHistory: detail.clanHistory,
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

  return (
    <>
      <LiveSync
        url={`/api/${region}/players/${encodeURIComponent(nickname)}/sse`}
        onUpdate={() => {
          void mutateData();
        }}
      />
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
      {!onTanks && (
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

      {onTanks ? (
        <TanksTab
          region={region}
          nickname={nickname}
          vehicles={detail.vehicles}
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
// on the default page load, which was the dominant SSR cost. The rows are
// already in the detail payload, so opening the tab renders client-side with no
// fetch; a `?tab=tanks` deep-link still server-renders them for SEO.
function TanksTab({
  region,
  nickname,
  vehicles,
}: {
  region: Region;
  nickname: string;
  vehicles: PlayerVehicleRow[];
}) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {nickname}&apos;s tanks ({intFmt.format(vehicles.length)})
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <PlayerVehiclesTable region={region} vehicles={vehicles} />
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
