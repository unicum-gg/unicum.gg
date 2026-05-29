import { notFound } from "next/navigation";
import { ClanHeader } from "@/components/clans/header";
import { ClanMembersTable } from "@/components/clans/members-table";
import { ClanRecentActivity } from "@/components/clans/recent-activity";
import { getClanMembersRatings } from "@/services/wargaming/wot/clans/ratings";
import { isRegion } from "@/services/wargaming/wot";
import {
  findClanIdByTag,
  getClanFullInfo,
  getClanMembersStats,
} from "@/services/wargaming/wot/clans";
import { getClanRecentEvents } from "@/services/wargaming/wot/clans/events";
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

  const [clan, members, events, encyclopedia, wn8Expected, wnxExpected] =
    await Promise.all([
      getClanFullInfo(region, clanId),
      getClanMembersStats(region, clanId),
      getClanRecentEvents(region, clanId, 30),
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
    ]);
  if (!clan) notFound();

  const ratingsByAccount = await getClanMembersRatings(
    region,
    members.map((m) => m.accountId),
    encyclopedia,
    wn8Expected,
    wnxExpected,
  );

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
      <ClanHeader region={region} clan={clan} members={members} />

      {clan.descriptionHtml && (
        <section
          className="mb-8 space-y-2 text-sm text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2"
          dangerouslySetInnerHTML={{ __html: clan.descriptionHtml }}
        />
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Members</h2>
        <ClanMembersTable
          region={region}
          members={members}
          ratingsByAccount={ratingsByAccount}
        />
      </section>

      <ClanRecentActivity region={region} events={events} />
    </div>
  );
}
