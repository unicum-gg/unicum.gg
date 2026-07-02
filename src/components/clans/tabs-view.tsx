"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { LiveSync } from "@/components/live-sync";
import { ClanWarsStatsTable } from "@/components/clans/clan-wars-stats";
import { ExpandableDescription } from "@/components/clans/description";
import { ClanMembersTable } from "@/components/clans/members-table";
import { PreviousClansTable } from "@/components/clans/previous-clans-table";
import { ClanRecentActivity } from "@/components/clans/recent-activity";
import { ClanStrongholdStatsTable } from "@/components/clans/stronghold-stats";
import { ClanTabsNav } from "@/components/clans/tabs-nav";
import { ClanTab, clanTabHref, tabFromQuery } from "@/components/clans/tabs";
import { ClanVehiclesTable } from "@/components/clans/vehicles-table";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  TableSkeleton,
  type SkeletonColumn,
} from "@/components/table-skeleton";
import { styles } from "@/lib/styles";
import type { ClanDetailData } from "@/services/clans/detail";
import type { ClanVehicleRow } from "@/services/clans/vehicles";
import {
  ClanDetailResponse,
  ClanVehiclesResponse,
} from "@/services/openapi/schemas";
import type { Region } from "@/services/wargaming/wot";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// Mirrors ClanVehiclesTable's columns so the loading placeholder lines up with
// the real table: centered icon columns, a wide left-aligned name, then
// right-aligned numeric columns.
const VEHICLES_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-6", align: "center" }, // Nation
  { width: "w-6", align: "center" }, // Type
  { width: "w-6", align: "center" }, // Tier
  { width: "w-28" }, // Name
  { width: "w-8", align: "right" }, // Members
  { width: "w-14", align: "right" }, // Battles
  { width: "w-12", align: "right" }, // Avg damage
  { width: "w-12", align: "right" }, // Avg XP
  { width: "w-12", align: "right" }, // Winrate
  { width: "w-14", align: "right" }, // Rating
];

async function vehiclesFetcher(url: string): Promise<ClanVehicleRow[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return ClanVehiclesResponse.parse(await res.json())
    .vehicles as unknown as ClanVehicleRow[];
}

// Parse the clan detail response with the shared OpenAPI schema: it validates
// the shape and `z.coerce.date()` revives ISO date strings into `Date`s, so no
// hand-written revival is needed. The cast restores the rich domain types the
// components expect (the schema is intentionally `.loose()`).
async function clanDetailFetcher(url: string): Promise<ClanDetailData> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return ClanDetailResponse.parse(await res.json()) as unknown as ClanDetailData;
}

export type ClanTabsViewProps = {
  region: Region;
  tag: string;
  basePath: string;
  activeTab: ClanTab;
  descriptionHtml: string | null;
  // Freshness-sensitive clan detail, seeded from the SSR render and kept live
  // by SWR (see the LiveSync wiring below).
  initialData: ClanDetailData;
  // Present only when Tanks is the tab the server rendered, so its content is
  // in the initial HTML (SEO for `?tab=tanks`); null otherwise, so the tab
  // fetches on demand when first opened.
  initialVehicles: ClanVehicleRow[] | null;
};

export function ClanTabsView({
  region,
  tag,
  basePath,
  activeTab,
  descriptionHtml,
  initialData,
  initialVehicles,
}: ClanTabsViewProps) {
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

  function select(next: ClanTab) {
    setTab(next);
    window.history.pushState(null, "", clanTabHref(basePath, next));
  }

  // Only the Tanks tab needs an on-demand fetch. SWR keys on the URL and only
  // runs when Tanks is active (null key = no request).
  const vehiclesUrl = `/api/${region}/clans/${encodeURIComponent(tag)}/vehicles`;
  const seededVehicles = initialVehicles != null;
  const { data: vehicles } = useSWR(
    tab === ClanTab.Tanks ? vehiclesUrl : null,
    vehiclesFetcher,
    {
      fallbackData: initialVehicles ?? undefined,
      // When the server already rendered Tanks (`initialVehicles` seeds the
      // cache), skip the on-mount revalidation so the heavy aggregation isn't
      // re-run for nothing. When it wasn't seeded, keep the default so opening
      // the tab from another tab actually fetches.
      revalidateOnMount: !seededVehicles,
    },
  );

  // The tab content (members, activity, snapshots) lives behind SWR so a
  // LiveSync tick refetches just this JSON and re-renders client-side, instead
  // of `router.refresh()` re-rendering the whole route on the server.
  // `initialData` seeds it from the SSR render, so there's no fetch on load;
  // only `mutateData()` (below) triggers a refetch.
  const dataUrl = `/api/${region}/clans/${encodeURIComponent(tag)}`;
  const { data: liveData, mutate: mutateData } = useSWR(
    dataUrl,
    clanDetailFetcher,
    { fallbackData: initialData, revalidateOnMount: false },
  );
  const { members, previousClans, events, snapshotLatest, snapshotPeriods } =
    liveData ?? initialData;

  return (
    <>
      <LiveSync
        url={`/api/${region}/clans/${encodeURIComponent(tag)}/live`}
        onUpdate={() => {
          void mutateData();
        }}
      />
      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <ClanTabsNav basePath={basePath} activeTab={tab} onSelect={select} />
        </PanelHeader>
      </Panel>

      {tab === ClanTab.Overview ? (
        <>
          {descriptionHtml && (
            <>
              <PanelSeparator />
              <Panel>
                <PanelContent>
                  <ExpandableDescription html={descriptionHtml} />
                </PanelContent>
              </Panel>
            </>
          )}

          <PanelSeparator />

          <Panel>
            <PanelHeader>
              <PanelTitle>Members</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <ClanMembersTable region={region} members={members} />
            </PanelContent>
          </Panel>

          {previousClans.length > 0 && (
            <>
              <PanelSeparator />
              <Panel>
                <PanelHeader>
                  <PanelTitle>Previous clans</PanelTitle>
                </PanelHeader>
                <PanelContent className="p-0">
                  <PreviousClansTable region={region} rows={previousClans} />
                </PanelContent>
              </Panel>
            </>
          )}

          {events.length > 0 && (
            <>
              <PanelSeparator />
              <Panel>
                <PanelHeader>
                  <PanelTitle>Recent activity</PanelTitle>
                </PanelHeader>
                <PanelContent className="p-0">
                  <ClanRecentActivity region={region} events={events} />
                </PanelContent>
              </Panel>
            </>
          )}
        </>
      ) : tab === ClanTab.Tanks ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>
                Tanks
                {vehicles ? ` (${intFmt.format(vehicles.length)})` : ""}
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {vehicles ? (
                <ClanVehiclesTable vehicles={vehicles} />
              ) : (
                <TableSkeleton
                  columns={VEHICLES_SKELETON_COLUMNS}
                  rows={12}
                />
              )}
            </PanelContent>
          </Panel>
        </>
      ) : tab === ClanTab.Stronghold ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>Stronghold stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {snapshotLatest && snapshotPeriods ? (
                <ClanStrongholdStatsTable
                  latest={snapshotLatest}
                  periods={snapshotPeriods}
                />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No stronghold data yet. Check back after the next clan refresh.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      ) : (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>Clan Wars stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {snapshotLatest && snapshotPeriods ? (
                <ClanWarsStatsTable
                  latest={snapshotLatest}
                  periods={snapshotPeriods}
                />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No Clan Wars data yet. Check back after the next clan refresh.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      )}
    </>
  );
}
