"use client";

import { useRouter } from "next/navigation";

import useSWR from "swr";
import { Panel, PanelHeader, PanelSeparator } from "@/components/panel";
import {
  PlayerModeNav,
  PlayerSectionNav,
} from "@/components/players/detail/tabs-nav";
import {
  PlayerMode,
  PlayerSection,
  playerModeHref,
  playerSectionHref,
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
import type {
  PlayerDetailData,
  PlayerTankRow,
  RatingMetric,
} from "@unicum.gg/shared";
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
  // Active rating metric (client-derived from the cookie in the parent), used to
  // project the metric-agnostic payload (liftDrag + ratingHistory carry all three).
  metric: RatingMetric;
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
  metric,
  metricLabel,
  nowMs,
  detail,
  initialTanks,
}: PlayerTabsViewProps) {
  // Each reachable (section, mode) pair is a route of its own, so both come from
  // the server and change through a real navigation. That is what keeps the
  // metadata (title, description, canonical) in step with what is on screen; a
  // `pushState` would leave Next unaware and freeze them on the view the page
  // was loaded with.
  const section = activeSection;
  const mode = activeMode;
  const router = useRouter();

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
    router.push(playerSectionHref(basePath, next));
  }
  function selectMode(next: PlayerMode) {
    router.push(playerModeHref(basePath, next));
  }

  const overall: OverallData = {
    current: detail.current,
    periods: detail.periods,
    derived: detail.derived,
    liftDrag: detail.liftDrag[metric],
    ratingData: detail.ratingHistory,
    metric,
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
