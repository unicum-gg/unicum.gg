import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { ExpandableDescription } from "@/components/clans/description";
import { ClanHeader } from "@/components/clans/header";
import { ClanMembersTable } from "@/components/clans/members-table";
import { PreviousClansTable } from "@/components/clans/previous-clans-table";
import { ClanRecentActivity } from "@/components/clans/recent-activity";
import { ClanStrongholdStatsTable } from "@/components/clans/stronghold-stats";
import { ClanWarsStatsTable } from "@/components/clans/clan-wars-stats";
import { ClanTabsNav, ClanTab, tabFromQuery } from "@/components/clans/tabs-nav";
import { ClanVehiclesTable } from "@/components/clans/vehicles-table";
import { LiveSync } from "@/components/live-sync";
import { ViewBeacon } from "@/components/view-beacon";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { PerfTrace, currentTrace, runWithTrace } from "@/lib/perf-trace";
import { clanSchema } from "@/lib/schema-org";
import { getPreviousClans } from "@/services/clans/previous-clans";
import { getClanByTagCached } from "@/services/clans/repository";
import { getClanEventsCached } from "@/services/clans/repository/events";
import { getClanMembersCached } from "@/services/clans/repository/members";
import { getClanTankAggregates } from "@/services/clans/repository/tanks";
import {
  getLatestClanSnapshot,
  getClanSnapshotPeriods,
} from "@/services/clans/snapshots";
import { styles } from "@/lib/styles";
import { isRegion, type Region } from "@/services/wargaming/wot";
import type { ClanRecentEvent } from "@/services/wargaming/wot/clans/events";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const loadClanByTag = cache(getClanByTagCached);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; tag: string }>;
}): Promise<Metadata> {
  const { region, tag } = await params;
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(tag);
  const regionLabel = region.toUpperCase();

  const cached = await loadClanByTag(region, decoded);
  if (!cached) {
    return constructMetadata({
      title: `[${decoded}] World of Tanks clan (${regionLabel})`,
      description: `[${decoded}] World of Tanks clan on ${regionLabel}: members table with WN8/WNX ratings, join/leave activity, recent battles and full clan history.`,
      ogImage: false,
    });
  }
  const clan = cached.info;
  const members = intFmt.format(clan.membersCount);
  return constructMetadata({
    title: `[${clan.tag}] ${clan.name} World of Tanks clan (${regionLabel}), ${members} members`,
    description: `${clan.name} [${clan.tag}] on ${regionLabel}: ${members} members, full members table with WN8 and WNX ratings, recent join/leave activity and clan history.`,
    ogImage: false,
  });
}

export default async function ClanPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; tag: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { region, tag } = await params;
  if (!isRegion(region)) notFound();
  const decoded = decodeURIComponent(tag);
  const { tab: tabParam } = await searchParams;
  const activeTab = tabFromQuery(tabParam);

  const trace = new PerfTrace(`ClanPage ${region}/${decoded}`);
  try {
    return await runWithTrace(trace, () => render(region, decoded, activeTab));
  } finally {
    trace.endRender();
  }
}

async function render(
  region: Region,
  decoded: string,
  activeTab: ClanTab,
): Promise<React.ReactElement> {
  const trace = currentTrace();
  const span = <T,>(name: string, fn: () => Promise<T>): Promise<T> =>
    trace ? trace.span(name, fn) : fn();

  const clanCached = await span("getClanByTagCached", () =>
    loadClanByTag(region, decoded),
  );
  if (!clanCached) notFound();
  const clan = clanCached.info;
  trace?.log(
    `clan fromDb=${clanCached.fromDb} refreshing=${clanCached.refreshing}`,
  );

  const membersCached = await span("getClanMembersCached", () =>
    getClanMembersCached(region, clan.id),
  );
  const members = membersCached.members;
  trace?.log(
    `members fromDb=${membersCached.fromDb} refreshing=${membersCached.refreshing} count=${members.length}`,
  );

  // Ratings (wn7/wn8/wnx/wnx30d) are pre-computed by refreshClanMembers
  // and cached on each row, so the table renders fully populated on first
  // paint — no Suspense boundary needed.

  const eventsPromise = span("getClanEventsCached (background)", async () => {
    const cached = await getClanEventsCached(region, clan.id, 30);
    return cached.events;
  });

  const [latestSnapshot, snapshotPeriods] =
    activeTab === ClanTab.Stronghold || activeTab === ClanTab.ClanWars
      ? await Promise.all([
          getLatestClanSnapshot(region, clan.id),
          getClanSnapshotPeriods(region, clan.id),
        ])
      : [null, null];

  const basePath = ROUTES.CLAN(region, clan.tag);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={clanSchema({
          tag: clan.tag,
          name: clan.name,
          region: region.toUpperCase(),
          membersCount: clan.membersCount,
          url: `${APP.URL}${ROUTES.CLAN(region, clan.tag)}`,
          description: `${clan.name} [${clan.tag}] World of Tanks clan on ${region.toUpperCase()}: ${clan.membersCount} members, WN8/WNX ratings, member rankings, recent join/leave activity.`,
          logo: clan.emblem,
        })}
      />
      <LiveSync
        url={`/api/${region}/clans/${encodeURIComponent(clan.tag)}/live`}
      />
      <ViewBeacon
        url={`/api/${region}/clans/${encodeURIComponent(clan.tag)}/enqueue`}
      />
      <Panel>
        <PanelContent className="p-0">
          <ClanHeader region={region} clan={clan} members={members} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <ClanTabsNav basePath={basePath} activeTab={activeTab} />
        </PanelHeader>
      </Panel>

      {activeTab === ClanTab.Overview ? (
        <>
          {clan.descriptionHtml && (
            <>
              <PanelSeparator />
              <Panel>
                <PanelContent>
                  <ExpandableDescription html={clan.descriptionHtml} />
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

          <PanelSeparator />

          <Suspense fallback={null}>
            <PreviousClansStreamed region={region} clanId={clan.id} />
          </Suspense>

          <PanelSeparator />

          <Suspense fallback={null}>
            <RecentActivityStreamed region={region} promise={eventsPromise} />
          </Suspense>
        </>
      ) : activeTab === ClanTab.Tanks ? (
        <>
          <PanelSeparator />
          <VehiclesPanel region={region} clanId={clan.id} />
        </>
      ) : activeTab === ClanTab.Stronghold ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>Stronghold stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {latestSnapshot && snapshotPeriods ? (
                <ClanStrongholdStatsTable
                  latest={latestSnapshot}
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
              {latestSnapshot && snapshotPeriods ? (
                <ClanWarsStatsTable
                  latest={latestSnapshot}
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
    </div>
  );
}

async function VehiclesPanel({
  region,
  clanId,
}: {
  region: Region;
  clanId: number;
}) {
  const [aggregates, encyclopedia, wn8Expected, wnxExpected] = await Promise.all(
    [
      getClanTankAggregates(region, clanId),
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
    ],
  );
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Tanks ({intFmt.format(aggregates.length)})</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <ClanVehiclesTable
          aggregates={aggregates}
          encyclopedia={encyclopedia}
          wn8Expected={wn8Expected}
          wnxExpected={wnxExpected}
        />
      </PanelContent>
    </Panel>
  );
}

async function RecentActivityStreamed({
  region,
  promise,
}: {
  region: Region;
  promise: Promise<ClanRecentEvent[]>;
}) {
  const events = await promise;
  if (events.length === 0) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Recent activity</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <ClanRecentActivity region={region} events={events} />
      </PanelContent>
    </Panel>
  );
}

async function PreviousClansStreamed({
  region,
  clanId,
}: {
  region: Region;
  clanId: number;
}) {
  const rows = await getPreviousClans(region, clanId);
  if (rows.length === 0) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Previous clans</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <PreviousClansTable region={region} rows={rows} />
      </PanelContent>
    </Panel>
  );
}
