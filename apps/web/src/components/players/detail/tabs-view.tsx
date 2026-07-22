"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Panel, PanelHeader, PanelSeparator } from "@/components/panel";
import {
  PlayerModeNav,
  PlayerSectionNav,
} from "@/components/players/detail/tabs-nav";
import {
  PlayerMode,
  PlayerSection,
  modeFromQuery,
  playerModeHref,
  playerSectionHref,
  sectionFromQuery,
} from "@/components/players/detail/tabs";
import {
  OverallTab,
  type OverallData,
} from "@/components/players/detail/overview";
import {
  StrongholdTab,
  type StrongholdData,
} from "@/components/players/detail/overview/stronghold";
import { TanksTab } from "@/components/players/detail/tanks";
import { ValueTab } from "@/components/players/detail/value";
import { unicum } from "@/services/sdk";
import type { PlayerDetailData, PlayerTankRow } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

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
  const tanksReq = () => unicum.region(region).players(nickname).tanks();
  const seededTanks = initialTanks != null;
  const { data: tanks } = useSWR(
    // Key off the request's own URL; null disables the fetch until Tanks is open.
    section === PlayerSection.Tanks ? tanksReq().url() : null,
    () => tanksReq().then((r) => r.tanks as unknown as PlayerTankRow[]),
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
            tankCount={detail.tankCount}
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
