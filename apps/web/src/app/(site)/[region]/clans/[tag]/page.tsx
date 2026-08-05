import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClanProfile } from "@/components/clans/detail/view";
import {
  ClanMode,
  ClanSection,
  type ClanView,
  clanViewHref,
  DEFAULT_CLAN_VIEW,
} from "@/components/clans/detail/tabs";
import type { ClanTabsInitialData } from "@/components/clans/detail/tabs-view";
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
    const { clan, ratings, nameHistory, vehiclesCount } = await unicum
      .region(region)
      .clans(tag)
      .overview();
    return {
      clan: clan as unknown as ClanFullInfo,
      ratings: ratings as unknown as ClanRatings,
      nameHistory: nameHistory as unknown as ClanNameHistoryEntry[],
      vehiclesCount: vehiclesCount ?? null,
    };
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

// ISR, not dynamic: the whole rendered profile is cached, so a navigation serves
// prerendered HTML instead of re-running the heavy clan-view render each time
// (measured 0.7-1.3s/nav while force-dynamic, vs ~50ms static). The section/mode
// nav is entirely client-side (tabs-view reads them from the URL), so this page
// reads no searchParams and stays static. Live data still hot-swaps via the
// clan SSE (LiveSync) client-side, and per-page-hit refreshes are enqueued by
// the client, exactly like the player page. On-demand generation (no
// generateStaticParams); the SDK loopback covers any build-time prerender.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

/** Suffix and wording for the view being rendered, so each mode is a page of
 * its own rather than three copies of the same title. */
function viewCopy(
  view: ClanView,
  name: string,
  tag: string,
  regionLabel: string,
  members: string,
): { title: string; description: string } {
  switch (view.mode === ClanMode.RandomBattles ? view.section : view.mode) {
    case ClanMode.Stronghold:
      return {
        title: `[${tag}] ${name} stronghold stats (${regionLabel})`,
        description: `${name} [${tag}] stronghold performance on ${regionLabel}: skirmish and advances ratings, battles and win rate for each member.`,
      };
    case ClanMode.ClanWars:
      return {
        title: `[${tag}] ${name} clan wars stats (${regionLabel})`,
        description: `${name} [${tag}] clan wars performance on ${regionLabel}: per-member ratings, battles and win rate across the global map campaigns.`,
      };
    case ClanSection.Tanks:
      return {
        title: `[${tag}] ${name} tanks (${regionLabel}), the clan's vehicles`,
        description: `Every vehicle played by ${name} [${tag}] on ${regionLabel}, with battles, win rate and average damage aggregated across the clan's members.`,
      };
    case ClanSection.Manage:
      return {
        title: `[${tag}] ${name} stronghold reserves (${regionLabel})`,
        description: `Activate and schedule ${name} [${tag}] stronghold reserves. Officers only.`,
      };
    default:
      return {
        title: `[${tag}] ${name} World of Tanks clan (${regionLabel}), ${members} members`,
        description: `${name} [${tag}] on ${regionLabel}: ${members} members, full members table with WN8 and WNX ratings, recent join/leave activity and clan history.`,
      };
  }
}

export async function clanMetadata(
  region: string,
  tag: string,
  view: ClanView,
): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(tag);
  const regionLabel = region.toUpperCase();
  // The Manage tab is a tool, not clan content: keep it out of the index.
  const noIndex = view.section === ClanSection.Manage;

  const overview = await loadOverview(region, decoded).catch(() => null);
  if (!overview) {
    const copy = viewCopy(view, "", decoded, regionLabel, "");
    return constructMetadata({
      title: copy.title.replace("[" + decoded + "]  ", "[" + decoded + "] "),
      description: `[${decoded}] World of Tanks clan on ${regionLabel}: members table with WN8/WNX ratings, join/leave activity, recent battles and full clan history.`,
      ogImage: `/api/og/${region}/clans/${encodeURIComponent(decoded)}`,
      // Static (ISR) page: pass the canonical explicitly, since generateCanonical()
      // reads headers() which isn't available during static generation (it would
      // otherwise fall back to the site root). Points at this view's own segment.
      canonical: clanViewHref(ROUTES.CLAN(region, decoded), view),
      noIndex,
    });
  }
  const { clan } = overview;
  const members = intFmt.format(clan.membersCount);
  const copy = viewCopy(view, clan.name, clan.tag, regionLabel, members);
  return constructMetadata({
    title: copy.title,
    description: copy.description,
    ogImage: `/api/og/${region}/clans/${encodeURIComponent(clan.tag)}`,
    // Static (ISR) page: canonical must be explicit (see the not-found branch).
    canonical: clanViewHref(ROUTES.CLAN(region, clan.tag), view),
    noIndex,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; tag: string }>;
}): Promise<Metadata> {
  const { region, tag } = await params;
  return clanMetadata(region, tag, DEFAULT_CLAN_VIEW);
}

export default async function ClanPage({
  params,
}: {
  params: Promise<{ region: string; tag: string }>;
}) {
  const { region, tag } = await params;
  if (!isRegion(region)) notFound();
  return renderClanPage(region, decodeURIComponent(tag), DEFAULT_CLAN_VIEW);
}

// Render the profile inline (blocking on the clan fetches) rather than
  // streaming it behind a Suspense skeleton: force-static prerenders the whole
  // page, so the real stats land in the cached HTML. That keeps the `.md` twin
  // and non-JS crawlers complete (a Suspense boundary would leave only the
  // skeleton in `#page-content`, with the stats streamed into a hidden node only
// JS swaps in). `view` comes from the route segment, so only that view renders
// and its metadata match what is on screen.
export function renderClanPage(
  region: Region,
  decoded: string,
  view: ClanView,
) {
  return <ClanProfileServer region={region} decoded={decoded} view={view} />;
}

/** The data-dependent half of the page. Its overview + section fetches block the
 * render so the static prerender captures the full profile (see the note above). */
async function ClanProfileServer({
  region,
  decoded,
  view,
}: {
  region: Region;
  decoded: string;
  view: ClanView;
}) {
  const { section, mode } = view;
  const overview = await loadOverview(region, decoded);
  if (!overview) notFound();
  const { clan, ratings } = overview;

  // Send the visitor to the tag this clan actually carries: a different casing
  // (the lookup is case-insensitive) or a tag the clan has since dropped, which
  // the repository resolves through the rename history instead of 404ing.
  // Temporary, like the player one: a freed tag can be taken by another clan.
  if (clan.tag !== decoded) {
    redirect(clanViewHref(ROUTES.CLAN(region, clan.tag), view));
  }
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
        initialVehiclesCount={overview.vehiclesCount ?? null}
        initialNameHistory={
          overview.nameHistory as unknown as ClanNameHistoryEntry[]
        }
      />
    </div>
  );
}
