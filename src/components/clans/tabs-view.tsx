"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
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
import type { ClanTankAggregate } from "@/services/clans/repository/tanks";
import type { ClanSnapshotPeriods } from "@/services/clans/snapshot-stats";
import type { PreviousClanRow } from "@/services/clans/previous-clans";
import type { ClanSnapshot } from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";
import type { ClanRecentEvent } from "@/services/wargaming/wot/clans/event-types";
import type { ClanMemberStats } from "@/services/wargaming/wot/clans/members";
import type { VehicleMeta } from "@/services/wargaming/wot/vehicle-meta";
import type {
  WN8Expected,
  WNXExpected,
} from "@/services/wargaming/wot/ratings";

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

// Wire shape of the /vehicles endpoint: Maps can't cross JSON, so the expected
// values travel as entry arrays.
type VehiclesPayload = {
  aggregates: ClanTankAggregate[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: [number, WN8Expected][];
  wnxExpected: [number, WNXExpected][];
};

// Resolved shape the ClanVehiclesTable consumes, with the Maps rebuilt.
export type VehiclesData = {
  aggregates: ClanTankAggregate[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
};

async function vehiclesFetcher(url: string): Promise<VehiclesData> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  const json = (await res.json()) as VehiclesPayload;
  return {
    aggregates: json.aggregates,
    encyclopedia: json.encyclopedia,
    wn8Expected: new Map(json.wn8Expected),
    wnxExpected: new Map(json.wnxExpected),
  };
}

export type ClanTabsViewProps = {
  region: Region;
  tag: string;
  basePath: string;
  activeTab: ClanTab;
  descriptionHtml: string | null;
  members: ClanMemberStats[];
  previousClans: PreviousClanRow[];
  events: ClanRecentEvent[];
  snapshotLatest: ClanSnapshot | null;
  snapshotPeriods: ClanSnapshotPeriods | null;
  // Present only when Tanks is the tab the server rendered, so its content is
  // in the initial HTML (SEO for `?tab=tanks`); null otherwise, so the tab
  // fetches on demand when first opened.
  initialVehicles: VehiclesData | null;
};

export function ClanTabsView({
  region,
  tag,
  basePath,
  activeTab,
  descriptionHtml,
  members,
  previousClans,
  events,
  snapshotLatest,
  snapshotPeriods,
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

  return (
    <>
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
                {vehicles
                  ? ` (${intFmt.format(vehicles.aggregates.length)})`
                  : ""}
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {vehicles ? (
                <ClanVehiclesTable
                  aggregates={vehicles.aggregates}
                  encyclopedia={vehicles.encyclopedia}
                  wn8Expected={vehicles.wn8Expected}
                  wnxExpected={vehicles.wnxExpected}
                />
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
