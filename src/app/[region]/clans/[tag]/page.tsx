import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExpandableDescription } from "@/components/clans/description";
import { ClanHeader } from "@/components/clans/header";
import { ClanMembersTable } from "@/components/clans/members-table";
import { ClanMetrics } from "@/components/clans/metrics";
import { ClanRecentActivity } from "@/components/clans/recent-activity";
import {
  Panel,
  PanelContent,
  PanelSeparator,
} from "@/components/panel";
import {
  getClanMembersRatings,
  type MemberRatings,
} from "@/services/wargaming/wot/clans/ratings";
import { isRegion, type Region } from "@/services/wargaming/wot";
import {
  type ClanMemberStats,
  findClanIdByTag,
  getClanFullInfo,
  getClanMembersStats,
} from "@/services/wargaming/wot/clans";
import {
  type ClanRecentEvent,
  getClanRecentEvents,
} from "@/services/wargaming/wot/clans/events";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";

export default async function ClanPage({
  params,
}: {
  params: Promise<{ region: string; tag: string }>;
}) {
  const { region, tag } = await params;
  if (!isRegion(region)) notFound();

  const decoded = decodeURIComponent(tag);
  const clanId = await findClanIdByTag(region, decoded);
  if (!clanId) notFound();

  const [clan, members, encyclopedia, wn8Expected, wnxExpected] =
    await Promise.all([
      getClanFullInfo(region, clanId),
      getClanMembersStats(region, clanId),
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
    ]);
  if (!clan) notFound();

  const ratingsPromise = getClanMembersRatings(
    region,
    members.map((m) => m.accountId),
    encyclopedia,
    wn8Expected,
    wnxExpected,
  );
  const eventsPromise = getClanRecentEvents(region, clanId, 30);

  return (
    <div className="mx-auto w-full max-w-7xl">
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
          <>
            <ClanMetrics members={members} ratingsByAccount={new Map()} />
            <section>
              <h2 className="mb-3 text-lg font-semibold">Members</h2>
              <ClanMembersTable
                region={region}
                members={members}
                ratingsByAccount={new Map()}
              />
            </section>
          </>
        }
      >
        <MembersWithRatings
          region={region}
          members={members}
          ratingsPromise={ratingsPromise}
        />
      </Suspense>

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
  clan: NonNullable<Awaited<ReturnType<typeof getClanFullInfo>>>;
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
  clan: NonNullable<Awaited<ReturnType<typeof getClanFullInfo>>>;
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
  return (
    <>
      <ClanMetrics members={members} ratingsByAccount={ratings} />
      <section>
        <h2 className="mb-3 text-lg font-semibold">Members</h2>
        <ClanMembersTable
          region={region}
          members={members}
          ratingsByAccount={ratings}
        />
      </section>
    </>
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
  return <ClanRecentActivity region={region} events={events} />;
}
