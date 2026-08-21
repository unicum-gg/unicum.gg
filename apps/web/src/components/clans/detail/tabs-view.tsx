"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { ExpandableDescription } from "@/components/clans/detail/description";
import { ClanModeNav, ClanSectionNav } from "@/components/clans/detail/tabs-nav";
import {
  ClanMode,
  ClanSection,
  clanModeHref,
  clanSectionHref,
} from "@/components/clans/detail/tabs";
import { ClanTanksTab } from "@/components/clans/detail/tanks";
import { ClanBoostConsole } from "@/components/clans/detail/boost-console";
import { ClanVideosTab } from "@/components/clans/detail/videos";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import { RandomBattlesTab } from "@/components/clans/detail/overview";
import { StrongholdTab } from "@/components/clans/detail/overview/stronghold";
import { ClanWarsTab } from "@/components/clans/detail/overview/clan-wars";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
} from "@/components/panel";
import { unicum } from "@/services/sdk";
import type { ClanRecentEvent } from "@unicum.gg/wargaming";
import {
  type ClanMemberStats,
  type ClanVehicleRow,
  type ClanGlobalMapView,
  type ClanStrongholdView,
} from "@unicum.gg/shared";
import type { PreviousClanRow } from "@/services/clans/previous-clans";
import type { Region } from "@unicum.gg/wargaming";

// The SSR seed: exactly what the per-section endpoints return, fetched by the
// page through the SDK (stronghold/clan-wars arrive as ready-made views).
export type ClanTabsInitialData = {
  members: ClanMemberStats[];
  previousClans: PreviousClanRow[];
  events: ClanRecentEvent[];
  stronghold: ClanStrongholdView;
  clanWars: ClanGlobalMapView;
};

export type ClanTabsViewProps = {
  region: Region;
  tag: string;
  clanId: number;
  // Materialized distinct-vehicle count from the overview, so "Tanks (N)" shows
  // before the (heavy) vehicles aggregation loads. Null until first computed.
  vehiclesCount: number | null;
  // The clan's custom color, used to tint the `[TAG]` brackets in panel titles.
  color: string;
  basePath: string;
  activeSection: ClanSection;
  activeMode: ClanMode;
  descriptionHtml: string | null;
  // Freshness-sensitive clan detail, seeded from the SSR render and kept live
  // by SWR (see the LiveSync wiring below).
  initialData: ClanTabsInitialData;
  // Present only when Tanks is the section the server rendered, so its content
  // is in the initial HTML (SEO for `?section=tanks`); null otherwise, so the
  // section fetches on demand when first opened.
  initialVehicles: ClanVehicleRow[] | null;
  initialVideos: TankVideoCardData[];
  // Bumped by the parent (ClanProfile) on each LiveSync tick; watched below to
  // refetch every section. The single LiveSync subscription lives in the parent
  // so the header stays in sync too.
  liveVersion: number;
};

export function ClanTabsView({
  region,
  tag,
  clanId,
  vehiclesCount,
  color,
  basePath,
  activeSection,
  activeMode,
  descriptionHtml,
  initialData,
  initialVehicles,
  initialVideos,
  liveVersion,
}: ClanTabsViewProps) {
  // Each reachable (section, mode) pair is a route of its own, so both come from
  // the server and change through a real navigation. That is what keeps the
  // metadata (title, description, canonical) in step with what is on screen; a
  // `pushState` would leave Next unaware and freeze them on the view the page
  // was loaded with.
  const section = activeSection;
  const mode = activeMode;
  const router = useRouter();

  function selectSection(next: ClanSection) {
    router.push(clanSectionHref(basePath, next));
  }
  function selectMode(next: ClanMode) {
    router.push(clanModeHref(basePath, next));
  }

  // Section content is fetched on demand through the SDK (`@/services/sdk`),
  // which hits our own API and revives dates. SWR keys stay the endpoint URLs
  // (stable cache identities); the `as unknown as` casts restore the rich
  // domain types the tables expect (the API schemas are intentionally loose).
  const clanApi = unicum.region(region).clans(tag);

  // Only the Tanks section needs an on-demand fetch. The key is the request's
  // own `.url()`, and only runs when Tanks is active (null key = no request).
  const seededVehicles = initialVehicles != null;
  const { data: vehicles } = useSWR(
    section === ClanSection.Tanks ? clanApi.vehicles().url() : null,
    () =>
      clanApi
        .vehicles()
        .then((r) => r.vehicles as unknown as ClanVehicleRow[]),
    {
      fallbackData: initialVehicles ?? undefined,
      // When the server already rendered Tanks (`initialVehicles` seeds the
      // cache), skip the on-mount revalidation so the heavy aggregation isn't
      // re-run for nothing. When it wasn't seeded, keep the default so opening
      // the section from another one actually fetches.
      revalidateOnMount: !seededVehicles,
    },
  );

  // Fetched whatever the section, because the nav labels the tab with the
  // count. The tab itself is always offered, at zero included: an empty video
  // tab is an invitation for a clan's first tactic. It is one small request,
  // cached by SWR, and it is the same one the section renders from.
  // Seeded by the server render, so the tactics are in the HTML and the tab
  // knows its count on the first paint. SWR still revalidates, which is what
  // picks up a tactic approved since the page was cached.
  const { data: videos } = useSWR(
    `clan-videos:${region}:${tag}`,
    () => clanApi.videos().then((r) => r.videos as unknown as TankVideoCardData[]),
    { fallbackData: initialVideos },
  );

  // The section content (members, activity, snapshots) lives behind SWR so a
  // LiveSync tick refetches just this JSON and re-renders client-side, instead
  // of `router.refresh()` re-rendering the whole route on the server.
  // `initialData` seeds it from the SSR render, so there's no fetch on load;
  // only `mutateData()` (below) triggers a refetch.
  const { data: membersData, mutate: mutateMembers } = useSWR(
    clanApi.members().url(),
    () =>
      clanApi
        .members()
        .then((r) => r.members as unknown as ClanMemberStats[]),
    { fallbackData: initialData.members, revalidateOnMount: false },
  );
  const { data: previousClansData, mutate: mutatePrevious } = useSWR(
    clanApi.previousClans().url(),
    () =>
      clanApi
        .previousClans()
        .then((r) => r.previousClans as unknown as PreviousClanRow[]),
    { fallbackData: initialData.previousClans, revalidateOnMount: false },
  );
  const { data: eventsData, mutate: mutateActivity } = useSWR(
    clanApi.activity().url(),
    () =>
      clanApi
        .activity()
        .then((r) => r.events as unknown as ClanRecentEvent[]),
    { fallbackData: initialData.events, revalidateOnMount: false },
  );
  const members = membersData ?? initialData.members;
  const previousClans = previousClansData ?? initialData.previousClans;
  const events = eventsData ?? initialData.events;
  // Stronghold / Clan Wars: the SSR seed is already the table-ready view
  // (latest + period diffs) served by the sub-endpoints; LiveSync refetches
  // the same endpoints.
  const strongholdSeed = initialData.stronghold;
  const clanWarsSeed = initialData.clanWars;
  const { data: strongholdData, mutate: mutateStronghold } = useSWR(
    clanApi.stronghold().url(),
    () => clanApi.stronghold().then((r) => r as unknown as ClanStrongholdView),
    { fallbackData: strongholdSeed, revalidateOnMount: false },
  );
  const { data: clanWarsData, mutate: mutateClanWars } = useSWR(
    clanApi.clanWars().url(),
    () => clanApi.clanWars().then((r) => r as unknown as ClanGlobalMapView),
    { fallbackData: clanWarsSeed, revalidateOnMount: false },
  );
  const stronghold = strongholdData ?? strongholdSeed;
  const clanWars = clanWarsData ?? clanWarsSeed;

  // A LiveSync tick in the parent bumps `liveVersion`; refetch every section's
  // JSON so the tables re-render client-side (skip the initial 0, whose data is
  // the fresh SSR seed).
  useEffect(() => {
    if (liveVersion === 0) return;
    void mutateMembers();
    void mutatePrevious();
    void mutateActivity();
    void mutateStronghold();
    void mutateClanWars();
  }, [
    liveVersion,
    mutateMembers,
    mutatePrevious,
    mutateActivity,
    mutateStronghold,
    mutateClanWars,
  ]);

  // The Manage tab is visible to everyone (visitors see a teaser inviting them
  // to log in); the console component itself gates the real controls to
  // officers of this clan, so no officer check is needed here.
  const onTanks = section === ClanSection.Tanks;
  const onManage = section === ClanSection.Manage;
  const onVideos = section === ClanSection.Videos;
  // Live length once the tanks aggregation has loaded, otherwise the
  // materialized count from the overview (so "(N)" shows without opening Tanks).
  const tankCount = vehicles?.length ?? vehiclesCount ?? undefined;

  return (
    <>
      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <ClanSectionNav
            basePath={basePath}
            section={section}
            onSelect={selectSection}
            tankCount={tankCount}
            videoCount={videos?.length}
          />
        </PanelHeader>
      </Panel>

      {/* The clan's own blurb (recruitment rules, voice server, palmares) is
          what Overview is about, so it sits between the section row and the mode
          row. The other sections are their own subject: it would push the
          vehicle table down on Tanks, and Manage is a tool, not clan content. */}
      {descriptionHtml && section === ClanSection.Overview && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelContent>
              <ExpandableDescription html={descriptionHtml} />
            </PanelContent>
          </Panel>
        </>
      )}

      {/* The mode row is a sibling section under Overview, so it gets the same
          diagonal separator as the content sections below it. */}
      {section === ClanSection.Overview && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="px-0! py-0!" screenLines={false}>
              <ClanModeNav basePath={basePath} mode={mode} onSelect={selectMode} />
            </PanelHeader>
          </Panel>
        </>
      )}

      {onManage ? (
        <ClanBoostConsole region={region} tag={tag} clanId={clanId} />
      ) : onVideos ? (
        <ClanVideosTab
          region={region}
          tag={tag}
          clanId={clanId}
          videos={videos}
        />
      ) : onTanks ? (
        <ClanTanksTab tag={tag} color={color} vehicles={vehicles} />
      ) : mode === ClanMode.RandomBattles ? (
        <RandomBattlesTab
          region={region}
          tag={tag}
          color={color}
          members={members}
          previousClans={previousClans}
          events={events}
        />
      ) : mode === ClanMode.Stronghold ? (
        <StrongholdTab
          region={region}
          tag={tag}
          color={color}
          stronghold={stronghold}
        />
      ) : (
        <ClanWarsTab tag={tag} color={color} clanWars={clanWars} />
      )}
    </>
  );
}
