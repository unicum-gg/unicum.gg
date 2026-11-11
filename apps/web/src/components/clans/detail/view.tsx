"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import type { LiveUpdate } from "@unicum.gg/sdk";
import { LiveSync } from "@/components/live-sync";
import { ClanHeader } from "@/components/clans/detail/header";
import { ClanNameHistory } from "@/components/clans/detail/name-history";
import { ClanSection, ClanMode } from "@/components/clans/detail/tabs";
import type { ClanNameHistoryEntry } from "@unicum.gg/core/clans/name-history";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import type { ClanTournamentRecord } from "@/components/clans/detail/tournaments/row";
import type { ClanManeuversData } from "@/components/clans/detail/overview/maneuvers";
import {
  ClanTabsView,
  type ClanTabsInitialData,
} from "@/components/clans/detail/tabs-view";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { unicum } from "@/services/sdk";
import type { ClanFullInfo } from "@unicum.gg/core/wargaming/wot/clans/info";
import type {
  ClanMemberStats,
  ClanRatings,
  ClanVehicleRow,
} from "@unicum.gg/shared";
import type { ClanRankBadge as ClanRankBadgeData } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Client shell owning the clan's live data: one SWR entry for the overview
 * (profile + ratings, seeded from SSR) plus the single LiveSync subscription
 * for the clan. A live tick refetches the overview (so the header's "Updated X
 * ago" + refresh beacon stay in sync) and bumps `liveVersion`, which the tabs
 * view watches to refetch its own sections. Mirrors PlayerProfile; the clan
 * data is split across endpoints, so the tabs keep their own SWR and we signal
 * them rather than threading one payload.
 */
export function ClanProfile({
  region,
  address,
  color,
  basePath,
  activeSection,
  activeMode,
  descriptionHtml,
  initialClan,
  initialRatings,
  initialData,
  initialBadges,
  initialTournamentWins,
  initialTournamentFeaturedWins,
  initialTournamentBestTitle,
  initialTournamentCount,
  initialVehicles,
  initialTournaments,
  initialManeuvers,
  initialVehiclesCount,
  initialVideos,
  initialNameHistory,
}: {
  region: Region;
  /** The clan's own URL segment, which for a clan that has ended is
   * `TAG-<id>` and not its bare tag (see `clanAddress`). Everything fetched
   * from the client is keyed by it: the bare tag of an ended clan belongs to
   * whoever holds that name today, so fetching by it would swap this page's
   * contents for that clan's as soon as the browser hydrated. */
  address: string;
  color: string;
  basePath: string;
  activeSection: ClanSection;
  activeMode: ClanMode;
  descriptionHtml: string | null;
  initialClan: ClanFullInfo;
  initialRatings: ClanRatings;
  initialData: ClanTabsInitialData;
  initialVehicles: ClanVehicleRow[] | null;
  initialTournaments: ClanTournamentRecord | null;
  /** Maneuvers record, server-rendered on a direct `/maneuvers` landing. */
  initialManeuvers: ClanManeuversData | null;
  initialVehiclesCount: number | null;
  /** Rendered by the server, so the tactics are in the HTML rather than fetched
   * once the browser has caught up. */
  initialVideos: TankVideoCardData[];
  initialNameHistory: ClanNameHistoryEntry[];
  initialBadges: ClanRankBadgeData[];
  /** The clan's tournament honours, for the winner's crest. Seeded like the
   * badges above and refreshed by the same overview read. */
  initialTournamentWins: number;
  initialTournamentFeaturedWins: number;
  initialTournamentBestTitle: string | null;
  initialTournamentCount: number;
}) {
  const overviewReq = () => unicum.region(region).clans(address).overview();
  const { data: overview, mutate: mutateOverview } = useSWR(
    overviewReq().url(),
    () =>
      overviewReq().then((r) => ({
        clan: r.clan as unknown as ClanFullInfo,
        ratings: r.ratings as unknown as ClanRatings,
        nameHistory: r.nameHistory as unknown as ClanNameHistoryEntry[],
        vehiclesCount: r.vehiclesCount ?? null,
        badges: (r.badges ?? []) as unknown as ClanRankBadgeData[],
        tournamentWins: r.tournamentWins ?? 0,
        tournamentFeaturedWins: r.tournamentFeaturedWins ?? 0,
        tournamentBestTitle: r.tournamentBestTitle ?? null,
        tournamentCount: r.tournamentCount ?? 0,
      })),
    {
      fallbackData: {
        clan: initialClan,
        ratings: initialRatings,
        nameHistory: initialNameHistory,
        vehiclesCount: initialVehiclesCount,
        badges: initialBadges,
        tournamentWins: initialTournamentWins,
        tournamentFeaturedWins: initialTournamentFeaturedWins,
        tournamentBestTitle: initialTournamentBestTitle,
        tournamentCount: initialTournamentCount,
      },
      revalidateOnMount: false,
    },
  );
  const clan = overview?.clan ?? initialClan;
  const ratings = overview?.ratings ?? initialRatings;
  const nameHistory = overview?.nameHistory ?? initialNameHistory;
  const vehiclesCount = overview?.vehiclesCount ?? initialVehiclesCount;
  const badges = overview?.badges ?? initialBadges;
  const tournamentWins = overview?.tournamentWins ?? initialTournamentWins;
  const tournamentFeaturedWins =
    overview?.tournamentFeaturedWins ?? initialTournamentFeaturedWins;
  const tournamentBestTitle =
    overview?.tournamentBestTitle ?? initialTournamentBestTitle;
  const tournamentCount = overview?.tournamentCount ?? initialTournamentCount;

  // Incremented on each live tick; the tabs view refetches its sections when it
  // changes (see ClanTabsView's effect on `liveVersion`).
  const [liveVersion, setLiveVersion] = useState(0);

  // Memoized so LiveSync only re-subscribes when the target clan changes.
  const liveSubscribe = useCallback(
    (onUpdate: (event: LiveUpdate) => void) =>
      unicum.region(region).clans(address).live(onUpdate),
    [region, address],
  );

  return (
    <>
      <LiveSync
        subscribe={liveSubscribe}
        onUpdate={() => {
          void mutateOverview();
          setLiveVersion((v) => v + 1);
        }}
        subject={address}
      />
      <Panel>
        <PanelContent className="p-0">
          <ClanHeader
            region={region}
            clan={clan}
            members={initialData.members as ClanMemberStats[]}
            ratings={ratings}
            badges={badges}
            tournamentWins={tournamentWins}
            tournamentFeaturedWins={tournamentFeaturedWins}
            tournamentBestTitle={tournamentBestTitle}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <ClanTabsView
        region={region}
        tag={clan.tag}
        address={address}
        clanId={clan.id}
        vehiclesCount={vehiclesCount}
        tournamentCount={tournamentCount}
        color={color}
        basePath={basePath}
        activeSection={activeSection}
        activeMode={activeMode}
        descriptionHtml={descriptionHtml}
        initialData={initialData}
        initialVehicles={initialVehicles}
        initialTournaments={initialTournaments}
        initialManeuvers={initialManeuvers}
        initialVideos={initialVideos}
        liveVersion={liveVersion}
      />

      {activeSection === ClanSection.Overview && nameHistory.length > 0 && (
        <>
          <PanelSeparator />
          <ClanNameHistory history={nameHistory} tag={clan.tag} color={color} />
        </>
      )}
    </>
  );
}
