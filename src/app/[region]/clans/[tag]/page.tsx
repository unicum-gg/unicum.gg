import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { ExpandableDescription } from "@/components/clans/description";
import { ClanHeader } from "@/components/clans/header";
import { ClanMembersTable } from "@/components/clans/members-table";
import { ClanRecentActivity } from "@/components/clans/recent-activity";
import { LiveSync } from "@/components/live-sync";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PerfTrace, currentTrace, runWithTrace } from "@/lib/perf-trace";
import { getClanByTagCached } from "@/services/clans/repository";
import { getClanEventsCached } from "@/services/clans/repository/events";
import { getClanMembersCached } from "@/services/clans/repository/members";
import {
  getClanMembersRatings,
  type MemberRatings,
} from "@/services/wargaming/wot/clans/ratings";
import { isRegion, type Region } from "@/services/wargaming/wot";
import type { ClanFullInfo } from "@/services/wargaming/wot/clans";
import type { ClanMemberStats } from "@/services/wargaming/wot/clans/members";
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
    return {
      title: `[${decoded}] (${regionLabel}) — World of Tanks clan — unicum.gg`,
    };
  }
  const clan = cached.info;
  const members = intFmt.format(clan.membersCount);
  return {
    title: `[${clan.tag}] ${clan.name} (${regionLabel}) — ${members} members — World of Tanks clan — unicum.gg`,
    description: `${clan.name} [${clan.tag}] on ${regionLabel}: ${members} members, full members table with WN8 and WNX ratings, recent join/leave activity and clan history.`,
  };
}

export default async function ClanPage({
  params,
}: {
  params: Promise<{ region: string; tag: string }>;
}) {
  const { region, tag } = await params;
  if (!isRegion(region)) notFound();
  const decoded = decodeURIComponent(tag);

  const trace = new PerfTrace(`ClanPage ${region}/${decoded}`);
  try {
    return await runWithTrace(trace, () => render(region, decoded));
  } finally {
    trace.endRender();
  }
}

async function render(
  region: Region,
  decoded: string,
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

  const [membersCached, encyclopedia, wn8Expected, wnxExpected] =
    await Promise.all([
      span("getClanMembersCached", () =>
        getClanMembersCached(region, clan.id),
      ),
      span("getVehicleEncyclopedia", () => getVehicleEncyclopedia(region)),
      span("getWN8ExpectedValues", () => getWN8ExpectedValues()),
      span("getWNXExpectedValues", () => getWNXExpectedValues()),
    ]);
  const members = membersCached.members;
  trace?.log(
    `members fromDb=${membersCached.fromDb} refreshing=${membersCached.refreshing} count=${members.length}`,
  );

  const ratingsPromise = span("getClanMembersRatings (background)", () =>
    getClanMembersRatings(
      region,
      members.map((m) => m.accountId),
      encyclopedia,
      wn8Expected,
      wnxExpected,
    ),
  );
  const eventsPromise = span("getClanEventsCached (background)", async () => {
    const cached = await getClanEventsCached(region, clan.id, 30);
    return cached.events;
  });

  return (
    <div className="mx-auto w-full max-w-7xl">
      <LiveSync
        url={`/api/${region}/clans/${encodeURIComponent(clan.tag)}/live`}
      />
      <Suspense
        fallback={
          <ClanHeaderPanel
            region={region}
            clan={clan}
            members={members}
            ratings={null}
          />
        }
      >
        <ClanHeaderWithRatings
          region={region}
          clan={clan}
          members={members}
          ratingsPromise={ratingsPromise}
        />
      </Suspense>

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

      <Suspense
        fallback={
          <MembersPanel
            region={region}
            members={members}
            ratings={new Map()}
          />
        }
      >
        <MembersWithRatings
          region={region}
          members={members}
          ratingsPromise={ratingsPromise}
        />
      </Suspense>

      <PanelSeparator />

      <Suspense fallback={null}>
        <RecentActivityStreamed region={region} promise={eventsPromise} />
      </Suspense>
    </div>
  );
}

function ClanHeaderPanel({
  region,
  clan,
  members,
  ratings,
}: {
  region: Region;
  clan: ClanFullInfo;
  members: ClanMemberStats[];
  ratings: Map<number, MemberRatings> | null;
}) {
  return (
    <Panel>
      <PanelContent className="p-0">
        <ClanHeader
          region={region}
          clan={clan}
          members={members}
          ratings={ratings}
        />
      </PanelContent>
    </Panel>
  );
}

async function ClanHeaderWithRatings({
  region,
  clan,
  members,
  ratingsPromise,
}: {
  region: Region;
  clan: ClanFullInfo;
  members: ClanMemberStats[];
  ratingsPromise: Promise<Map<number, MemberRatings>>;
}) {
  const ratings = await ratingsPromise;
  return (
    <ClanHeaderPanel
      region={region}
      clan={clan}
      members={members}
      ratings={ratings}
    />
  );
}

function MembersPanel({
  region,
  members,
  ratings,
}: {
  region: Region;
  members: ClanMemberStats[];
  ratings: Map<number, MemberRatings>;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Members</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <ClanMembersTable
          region={region}
          members={members}
          ratingsByAccount={ratings}
        />
      </PanelContent>
    </Panel>
  );
}

async function MembersWithRatings({
  region,
  members,
  ratingsPromise,
}: {
  region: Region;
  members: ClanMemberStats[];
  ratingsPromise: Promise<Map<number, MemberRatings>>;
}) {
  const ratings = await ratingsPromise;
  return <MembersPanel region={region} members={members} ratings={ratings} />;
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
