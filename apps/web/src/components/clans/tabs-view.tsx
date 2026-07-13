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
import { ClanModeNav, ClanSectionNav } from "@/components/clans/tabs-nav";
import {
  ClanMode,
  ClanSection,
  clanModeHref,
  clanSectionHref,
  modeFromQuery,
  sectionFromQuery,
} from "@/components/clans/tabs";
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
import type { ClanVehicleRow } from "@unicum.gg/core/clans/vehicles";
import { ClanDetailResponse } from "@/app/api/[region]/clans/[tag]/schema.api";
import { ClanVehiclesResponse } from "@/app/api/[region]/clans/[tag]/vehicles/schema.api";
import type { Region } from "@unicum.gg/wargaming/region";

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

// Renders a panel title prefixed with the clan tag, its brackets tinted with
// the clan's own color (matching the header's `[TAG]` treatment).
function TaggedTitle({
  tag,
  color,
  children,
}: {
  tag: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span style={{ color }}>[</span>
      {tag}
      <span style={{ color }}>]</span> {children}
    </>
  );
}

export type ClanTabsViewProps = {
  region: Region;
  tag: string;
  // The clan's custom color, used to tint the `[TAG]` brackets in panel titles.
  color: string;
  basePath: string;
  activeSection: ClanSection;
  activeMode: ClanMode;
  descriptionHtml: string | null;
  // Freshness-sensitive clan detail, seeded from the SSR render and kept live
  // by SWR (see the LiveSync wiring below).
  initialData: ClanDetailData;
  // Present only when Tanks is the section the server rendered, so its content
  // is in the initial HTML (SEO for `?section=tanks`); null otherwise, so the
  // section fetches on demand when first opened.
  initialVehicles: ClanVehicleRow[] | null;
};

export function ClanTabsView({
  region,
  tag,
  color,
  basePath,
  activeSection,
  activeMode,
  descriptionHtml,
  initialData,
  initialVehicles,
}: ClanTabsViewProps) {
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

  function selectSection(next: ClanSection) {
    setSection(next);
    window.history.pushState(null, "", clanSectionHref(basePath, next, mode));
  }
  function selectMode(next: ClanMode) {
    setMode(next);
    setSection(ClanSection.Overview);
    window.history.pushState(null, "", clanModeHref(basePath, next));
  }

  // Only the Tanks section needs an on-demand fetch. SWR keys on the URL and
  // only runs when Tanks is active (null key = no request).
  const vehiclesUrl = `/api/${region}/clans/${encodeURIComponent(tag)}/vehicles`;
  const seededVehicles = initialVehicles != null;
  const { data: vehicles } = useSWR(
    section === ClanSection.Tanks ? vehiclesUrl : null,
    vehiclesFetcher,
    {
      fallbackData: initialVehicles ?? undefined,
      // When the server already rendered Tanks (`initialVehicles` seeds the
      // cache), skip the on-mount revalidation so the heavy aggregation isn't
      // re-run for nothing. When it wasn't seeded, keep the default so opening
      // the section from another one actually fetches.
      revalidateOnMount: !seededVehicles,
    },
  );

  // The section content (members, activity, snapshots) lives behind SWR so a
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

  const onTanks = section === ClanSection.Tanks;

  return (
    <>
      <LiveSync
        url={`/api/${region}/clans/${encodeURIComponent(tag)}/sse`}
        onUpdate={() => {
          void mutateData();
        }}
      />
      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <ClanSectionNav
            basePath={basePath}
            section={section}
            mode={mode}
            onSelect={selectSection}
          />
        </PanelHeader>
      </Panel>

      {/* The description is clan-level metadata, so it stays visible on every
          section, sitting between the section row and the mode row. */}
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

      {/* The mode row is a sibling section under Overview, so it gets the same
          diagonal separator as the content sections below it. */}
      {!onTanks && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="px-0! py-0!" screenLines={false}>
              <ClanModeNav
                basePath={basePath}
                mode={mode}
                onSelect={selectMode}
              />
            </PanelHeader>
          </Panel>
        </>
      )}

      {onTanks ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>
                <TaggedTitle tag={tag} color={color}>
                  tanks
                  {vehicles ? ` (${intFmt.format(vehicles.length)})` : ""}
                </TaggedTitle>
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {vehicles ? (
                <ClanVehiclesTable vehicles={vehicles} />
              ) : (
                <TableSkeleton columns={VEHICLES_SKELETON_COLUMNS} rows={12} />
              )}
            </PanelContent>
          </Panel>
        </>
      ) : mode === ClanMode.RandomBattles ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>
                <TaggedTitle tag={tag} color={color}>
                  members random battles stats
                </TaggedTitle>
              </PanelTitle>
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
                  <PanelTitle>
                    <TaggedTitle tag={tag} color={color}>
                      members previous clans
                    </TaggedTitle>
                  </PanelTitle>
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
                  <PanelTitle>
                    <TaggedTitle tag={tag} color={color}>
                      recent activity
                    </TaggedTitle>
                  </PanelTitle>
                </PanelHeader>
                <PanelContent className="p-0">
                  <ClanRecentActivity region={region} events={events} />
                </PanelContent>
              </Panel>
            </>
          )}
        </>
      ) : mode === ClanMode.Stronghold ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>
                <TaggedTitle tag={tag} color={color}>
                  stronghold stats
                </TaggedTitle>
              </PanelTitle>
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
              <PanelTitle>
                <TaggedTitle tag={tag} color={color}>
                  clan wars stats
                </TaggedTitle>
              </PanelTitle>
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
