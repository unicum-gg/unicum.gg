import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClanProfile } from "@/components/clans/clan-profile";
import {
  ClanSection,
  modeFromQuery,
  sectionFromQuery,
} from "@/components/clans/tabs";
import type { ClanTabsInitialData } from "@/components/clans/tabs-view";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, clanSchema } from "@/lib/schema-org";
import { unicum } from "@/services/sdk";
import { UnicumError } from "@unicum.gg/sdk";
import type { ClanRatings, ClanVehicleRow } from "@unicum.gg/shared";
import type { ClanFullInfo } from "@unicum.gg/core/wargaming/wot/clans/info";
import type { ClanNameHistoryEntry } from "@unicum.gg/core/clans/name-history";
import { isRegion, type Region } from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// The page consumes its own public API through the SDK: the overview (profile +
// aggregate ratings) plus the per-section endpoints the client refetches on
// LiveSync. Next memoizes identical fetches within one render pass, so
// generateMetadata and the page body share the overview request. The overview
// endpoint owns the cold-cache path (resolve tag on WG + fetch live).
async function loadOverview(region: Region, tag: string) {
  try {
    const { clan, ratings, nameHistory } = await unicum
      .region(region)
      .clans(tag)
      .overview();
    return {
      clan: clan as unknown as ClanFullInfo,
      ratings: ratings as unknown as ClanRatings,
      nameHistory: nameHistory as unknown as ClanNameHistoryEntry[],
    };
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

// Dynamic on purpose: the page consumes our own API through the SDK, and
// prerendering it at build time would make the build depend on a running API.
// The endpoints cache server-side, so per-request cost is local HTTP hops onto
// cached payloads.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; tag: string }>;
}): Promise<Metadata> {
  const { region, tag } = await params;
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(tag);
  const regionLabel = region.toUpperCase();

  const overview = await loadOverview(region, decoded).catch(() => null);
  if (!overview) {
    return constructMetadata({
      title: `[${decoded}] World of Tanks clan (${regionLabel})`,
      description: `[${decoded}] World of Tanks clan on ${regionLabel}: members table with WN8/WNX ratings, join/leave activity, recent battles and full clan history.`,
      ogImage: false,
    });
  }
  const { clan } = overview;
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
  searchParams: Promise<{ tab?: string; section?: string }>;
}) {
  const [{ region, tag }, { tab: tabParam, section: sectionParam }] =
    await Promise.all([params, searchParams]);
  if (!isRegion(region)) notFound();
  const decoded = decodeURIComponent(tag);
  // Two independent nav axes, each its own query param (see components/clans/tabs).
  const section = sectionFromQuery(sectionParam);
  const mode = modeFromQuery(tabParam);

  const overview = await loadOverview(region, decoded);
  if (!overview) notFound();
  const { clan, ratings } = overview;
  const clanApi = unicum.region(region).clans(clan.tag);

  // The Overview modes (Random Battles, Stronghold, Clan Wars) are always
  // loaded so switching between them is an instant client toggle with no
  // server round-trip, the same payloads LiveSync refetches client-side.
  // Tanks is the heavy aggregation, fetched only when it is the section
  // being rendered (deep links / SEO); otherwise the client loads it on
  // demand through SWR.
  const [members, previousClans, activity, stronghold, clanWars, vehicles] =
    await Promise.all([
      clanApi.members(),
      clanApi.previousClans(),
      clanApi.activity(),
      clanApi.stronghold(),
      clanApi.clanWars(),
      section === ClanSection.Tanks ? clanApi.vehicles() : Promise.resolve(null),
    ]);

  const initialData = {
    members: members.members,
    previousClans: previousClans.previousClans,
    events: activity.events,
    stronghold,
    clanWars,
  } as unknown as ClanTabsInitialData;
  const initialVehicles = vehicles
    ? (vehicles.vehicles as unknown as ClanVehicleRow[])
    : null;

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
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: `${APP.URL}${ROUTES.HOME(region)}` },
          { name: "Clans", url: `${APP.URL}${ROUTES.CLANS(region)}` },
          {
            name: `[${clan.tag}] ${clan.name}`,
            url: `${APP.URL}${ROUTES.CLAN(region, clan.tag)}`,
          },
        ])}
      />
      <ClanProfile
        region={region}
        tag={clan.tag}
        color={clan.color}
        basePath={basePath}
        activeSection={section}
        activeMode={mode}
        descriptionHtml={clan.descriptionHtml ?? null}
        initialClan={clan}
        initialRatings={ratings}
        initialData={initialData}
        initialVehicles={initialVehicles}
        initialNameHistory={
          overview.nameHistory as unknown as ClanNameHistoryEntry[]
        }
      />
    </div>
  );
}
