"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import type { LiveUpdate } from "@unicum.gg/sdk";
import { LiveSync } from "@/components/live-sync";
import { ClanHeader } from "@/components/clans/header";
import { ClanNameHistory } from "@/components/clans/name-history";
import { ClanSection, ClanMode } from "@/components/clans/tabs";
import type { ClanNameHistoryEntry } from "@unicum.gg/core/clans/name-history";
import {
  ClanTabsView,
  type ClanTabsInitialData,
} from "@/components/clans/tabs-view";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { unicum } from "@/services/sdk";
import type { ClanFullInfo } from "@unicum.gg/core/wargaming/wot/clans/info";
import type {
  ClanMemberStats,
  ClanRatings,
  ClanVehicleRow,
} from "@unicum.gg/shared";
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
  tag,
  color,
  basePath,
  activeSection,
  activeMode,
  descriptionHtml,
  initialClan,
  initialRatings,
  initialData,
  initialVehicles,
  initialNameHistory,
}: {
  region: Region;
  tag: string;
  color: string;
  basePath: string;
  activeSection: ClanSection;
  activeMode: ClanMode;
  descriptionHtml: string | null;
  initialClan: ClanFullInfo;
  initialRatings: ClanRatings;
  initialData: ClanTabsInitialData;
  initialVehicles: ClanVehicleRow[] | null;
  initialNameHistory: ClanNameHistoryEntry[];
}) {
  const overviewUrl = `/api/${region}/clans/${encodeURIComponent(tag)}`;
  const { data: overview, mutate: mutateOverview } = useSWR(
    overviewUrl,
    () =>
      unicum
        .region(region)
        .clans(tag)
        .overview()
        .then((r) => ({
          clan: r.clan as unknown as ClanFullInfo,
          ratings: r.ratings as unknown as ClanRatings,
          nameHistory: r.nameHistory as unknown as ClanNameHistoryEntry[],
        })),
    {
      fallbackData: {
        clan: initialClan,
        ratings: initialRatings,
        nameHistory: initialNameHistory,
      },
      revalidateOnMount: false,
    },
  );
  const clan = overview?.clan ?? initialClan;
  const ratings = overview?.ratings ?? initialRatings;
  const nameHistory = overview?.nameHistory ?? initialNameHistory;

  // Incremented on each live tick; the tabs view refetches its sections when it
  // changes (see ClanTabsView's effect on `liveVersion`).
  const [liveVersion, setLiveVersion] = useState(0);

  // Memoized so LiveSync only re-subscribes when the target clan changes.
  const liveSubscribe = useCallback(
    (onUpdate: (event: LiveUpdate) => void) =>
      unicum.region(region).clans(tag).live(onUpdate),
    [region, tag],
  );

  return (
    <>
      <LiveSync
        subscribe={liveSubscribe}
        onUpdate={() => {
          void mutateOverview();
          setLiveVersion((v) => v + 1);
        }}
      />
      <Panel>
        <PanelContent className="p-0">
          <ClanHeader
            region={region}
            clan={clan}
            members={initialData.members as ClanMemberStats[]}
            ratings={ratings}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <ClanTabsView
        region={region}
        tag={tag}
        color={color}
        basePath={basePath}
        activeSection={activeSection}
        activeMode={activeMode}
        descriptionHtml={descriptionHtml}
        initialData={initialData}
        initialVehicles={initialVehicles}
        liveVersion={liveVersion}
      />

      {activeSection === ClanSection.Overview && nameHistory.length > 0 && (
        <>
          <PanelSeparator />
          <ClanNameHistory history={nameHistory} tag={tag} color={color} />
        </>
      )}
    </>
  );
}
