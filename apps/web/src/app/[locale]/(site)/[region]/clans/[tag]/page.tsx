import { numberFormat } from "@/lib/format";
import type { Metadata } from "next";
import type { TranslateFunction } from "@onruntime/translations";
import { localizePath } from "@/lib/translations";
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
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import type { ClanTournamentRecord } from "@/components/clans/detail/tournaments/row";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { breadcrumbSchema, clanSchema } from "@/lib/schema-org";
import { unicum } from "@/services/sdk";
import { UnicumError } from "@unicum.gg/sdk";
import type {
  ClanRankBadge as ClanRankBadgeData,
  ClanRatings,
  ClanVehicleRow,
} from "@unicum.gg/shared";
import type { ClanFullInfo } from "@unicum.gg/core/wargaming/wot/clans/info";
import type { ClanNameHistoryEntry } from "@unicum.gg/core/clans/name-history";
import { isRegion, type Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

// The page consumes its own public API through the SDK: the overview (profile +
// aggregate ratings) plus the per-section endpoints the client refetches on
// LiveSync. Next memoizes identical fetches within one render pass, so
// generateMetadata and the page body share the overview request. The overview
// endpoint owns the cold-cache path (resolve tag on WG + fetch live).
async function loadOverview(region: Region, tag: string) {
  try {
    const {
      clan,
      ratings,
      nameHistory,
      vehiclesCount,
      badges,
      tournamentWins,
      tournamentFeaturedWins,
      tournamentBestTitle,
    } = await unicum
      .region(region)
      .clans(tag)
      .overview();
    return {
      clan: clan as unknown as ClanFullInfo,
      ratings: ratings as unknown as ClanRatings,
      nameHistory: nameHistory as unknown as ClanNameHistoryEntry[],
      vehiclesCount: vehiclesCount ?? null,
      badges: (badges ?? []) as unknown as ClanRankBadgeData[],
      tournamentWins: tournamentWins ?? 0,
      tournamentFeaturedWins: tournamentFeaturedWins ?? 0,
      tournamentBestTitle: tournamentBestTitle ?? null,
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
 * its own rather than three copies of the same title. The wording lives in
 * `app/clans/detail/page`, keyed by the view. */
function viewCopy(
  view: ClanView,
  name: string,
  tag: string,
  regionLabel: string,
  members: string,
  t: TranslateFunction,
): { title: string; description: string } {
  const key = view.mode === ClanMode.RandomBattles ? view.section : view.mode;
  const block =
    key === ClanMode.Stronghold
      ? "stronghold"
      : key === ClanMode.ClanWars
        ? "clan-wars"
        : key === ClanSection.Tanks
          ? "tanks"
          : key === ClanSection.Manage
            ? "manage"
            : "overview";
  const values = { name, tag, region: regionLabel, members };
  return {
    title: t(`${block}.title`, values),
    description: t(`${block}.description`, values),
  };
}

export async function clanMetadata(
  region: string,
  tag: string,
  view: ClanView,
  locale: string,
): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(tag);
  const regionLabel = region.toUpperCase();
  // The Manage tab is a tool, not clan content: keep it out of the index.
  let noIndex = view.section === ClanSection.Manage;

  const { t } = await getTranslation("app/clans/detail/page", locale);
  const overview = await loadOverview(region, decoded).catch(() => null);
  if (!overview) {
    const copy = viewCopy(view, "", decoded, regionLabel, "", t);
    return constructMetadata({
    locale,
      title: copy.title.replace("[" + decoded + "]  ", "[" + decoded + "] "),
      description: t("missing.description", {
        tag: decoded,
        region: regionLabel,
      }),
      ogImage: `/api/og/${region}/clans/${encodeURIComponent(decoded)}`,
      // Static (ISR) page: pass the canonical explicitly, since generateCanonical()
      // reads headers() which isn't available during static generation (it would
      // otherwise fall back to the site root). Points at this view's own segment.
      canonical: clanViewHref(ROUTES.CLAN(region, decoded), view),
      noIndex,
    });
  }
  const { clan } = overview;
  // The Videos tab is shown even empty (it invites the clan's first tactic),
  // but an empty one is thin content: keep it out of the index until it holds a
  // tactic. Same fetch the page makes, so it is deduped within this render.
  if (view.section === ClanSection.Videos && !noIndex) {
    const { videos } = await unicum
      .region(region)
      .clans(clan.tag)
      .videos()
      .catch(() => ({ videos: [] as unknown[] }));
    noIndex = videos.length === 0;
  }
  const members = numberFormat(locale, INT_FORMAT).format(clan.membersCount);
  const copy = viewCopy(
    view,
    clan.name, clan.tag, regionLabel, members,
    t,
  );
  return constructMetadata({
    locale,
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
  params: Promise<{ locale: string; region: string; tag: string }>;
}): Promise<Metadata> {
  const { locale, region, tag } = await params;
  return clanMetadata(region, tag, DEFAULT_CLAN_VIEW, locale);
}

export default async function ClanPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; tag: string }>;
}) {
  const { locale, region, tag } = await params;
  if (!isRegion(region)) notFound();
  return renderClanPage(
    region,
    decodeURIComponent(tag),
    DEFAULT_CLAN_VIEW,
    locale,
  );
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
  locale: string,
) {
  return (
    <ClanProfileServer
      region={region}
      decoded={decoded}
      view={view}
      locale={locale}
    />
  );
}

/** The data-dependent half of the page. Its overview + section fetches block the
 * render so the static prerender captures the full profile (see the note above). */
async function ClanProfileServer({
  region,
  decoded,
  view,
  locale,
}: {
  region: Region;
  decoded: string;
  view: ClanView;
  /** Carried down only to keep the canonical-tag redirect in the reader's
   * language: a bare path would leave the proxy to guess it back. */
  locale: string;
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
    redirect(
      localizePath(clanViewHref(ROUTES.CLAN(region, clan.tag), view), locale),
    );
  }
  const clanApi = unicum.region(region).clans(clan.tag);

  // The Overview modes (Random Battles, Stronghold, Clan Wars) are always
  // loaded so switching between them is an instant client toggle with no
  // server round-trip, the same payloads LiveSync refetches client-side.
  // Tanks is the heavy aggregation, fetched only when it is the section
  // being rendered (deep links / SEO); otherwise the client loads it on
  // demand through SWR.
  const [
    members,
    previousClans,
    activity,
    stronghold,
    clanWars,
    vehicles,
    tournaments,
    videos,
  ] = await Promise.all([
    clanApi.members(),
    clanApi.previousClans(),
    clanApi.activity(),
    clanApi.stronghold(),
    clanApi.clanWars(),
    section === ClanSection.Tanks ? clanApi.vehicles() : Promise.resolve(null),
    // Like Tanks: rendered here when it is the section being served, so the
    // table is in the HTML rather than fetched after hydration. Skipped
    // otherwise, since the read joins across the whole tournament archive and
    // most clans have never entered one.
    section === ClanSection.Tournaments
      ? clanApi.tournaments()
      : Promise.resolve(null),
    // Always, whatever the section: the nav needs the count to decide whether
    // to offer the tab, and it is a small read. Rendered here rather than
    // fetched by the browser so the tactics are in the HTML, which is what the
    // `.md` twin converts and what a crawler reads.
    clanApi.videos(),
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
  const initialVideos = videos.videos as unknown as TankVideoCardData[];
  const initialTournaments = tournaments
    ? (tournaments as unknown as ClanTournamentRecord)
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
        initialTournaments={initialTournaments}
        initialVehiclesCount={overview.vehiclesCount ?? null}
        initialVideos={initialVideos}
        initialBadges={overview.badges}
        initialTournamentWins={overview.tournamentWins}
        initialTournamentFeaturedWins={overview.tournamentFeaturedWins}
        initialTournamentBestTitle={overview.tournamentBestTitle}
        initialNameHistory={
          overview.nameHistory as unknown as ClanNameHistoryEntry[]
        }
      />
    </div>
  );
}
