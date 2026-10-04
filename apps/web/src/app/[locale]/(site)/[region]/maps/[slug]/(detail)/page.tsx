import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { MapVideosPanel } from "@/components/maps/detail/videos";
import { MapDetailTab, mapDetailTabHref } from "@/components/maps/detail/tabs";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { mapDescription, mapName } from "@/components/game-name";
import {
  availableMapTabs,
  loadMapDetail,
  loadMapHistory,
  loadMapRatings,
  loadMapVideos,
  type MapDetailPayload,
} from "@/app/[locale]/(site)/[region]/maps/[slug]/detail";

// ISR, not dynamic: the rendered tab is cached, so a navigation serves
// prerendered HTML. Each tab is its own route segment, so a render builds the
// requested one rather than all of them (see tabs.ts). Pages generate on first
// request (no generateStaticParams for the ~50 slugs) and revalidate on the map
// data's patch cadence; an approved tactic drops this page from the cache
// through the suggestion endpoint's own `revalidatePath`, so the window is not
// what a contributor waits on. The SDK loopback covers any build-time
// prerender.
export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * Per-tab title and description.
 *
 * Each tab is its own indexable URL, so they get their own wording rather than
 * three copies of the same one. The default tab keeps the section's original
 * copy, including the fallback that prefers Wargaming's own blurb over a
 * sentence we assemble, since that address is the map's canonical.
 */
async function tabCopy(
  tab: MapDetailTab,
  detail: MapDetailPayload,
  regionLabel: string,
  locale: string,
): Promise<{ title: string; description: string }> {
  const { t } = await getTranslation("app/maps/detail/page", locale);
  // The game's own name for the arena, so the browser tab and the search result
  // read like the client the visitor plays. Same source as the page's heading.
  const { t: tMaps } = await getTranslation("game/maps", locale);
  const { t: tBlurbs } = await getTranslation("game/map-descriptions", locale);
  const map = mapName(detail.arenaId, detail.name, tMaps);
  const values = { map, region: regionLabel };

  if (tab !== MapDetailTab.Videos) {
    return {
      title: t(`${tab}.title`, values),
      description: t(`${tab}.description`, values),
    };
  }

  const modes = detail.geometry.map((g) => g.label).join(", ");
  return {
    title: t("title", values),
    description:
      mapDescription(detail.arenaId, detail.description, tBlurbs) ||
      t(modes ? "description-modes" : "description", {
        ...values,
        width: detail.widthMeters,
        height: detail.heightMeters,
        modes,
      }),
  };
}

export async function mapMetadata(
  region: string,
  slug: string,
  tab: MapDetailTab,
  locale: string,
): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const detail = await loadMapDetail(region, slug).catch(() => null);
  if (!detail) return {};
  const { title, description } = await tabCopy(
    tab,
    detail,
    region.toUpperCase(),
    locale,
  );

  // The Community tab is shown even unrated, because that is where the rating
  // form lives, but a page whose only content is an empty form is not one worth
  // indexing. The same rule the vehicle tabs follow, and it clears itself with
  // the first vote.
  const noIndex =
    tab === MapDetailTab.Community &&
    (await loadMapRatings(region, detail.slug)).votes === 0;

  return constructMetadata({
    locale,
    title,
    description,
    // The readable slug, so a legacy arena-id URL does not become the canonical,
    // and this tab's own segment, so the three do not compete.
    canonical: mapDetailTabHref(ROUTES.MAP(region, detail.slug), tab),
    ogImage: `/api/og/${region}/maps/${encodeURIComponent(detail.slug)}`,
    noIndex,
  });
}

/**
 * Loads the map for one tab, and settles where the reader should be.
 *
 * Two redirects, both of which the layout above deliberately leaves alone: a
 * legacy arena-id (or non-canonical) URL goes to the readable slug with a 308,
 * carrying the tab, and a tab this map has nothing for falls back to the first
 * one it does have. The second is not permanent: a map we have recorded no
 * version of today can have one next update.
 */
export async function loadMapTab(
  region: Region,
  slug: string,
  tab: MapDetailTab,
  locale: string,
): Promise<MapDetailPayload> {
  const detail = await loadMapDetail(region, slug);
  if (!detail) notFound();
  if (detail.slug !== slug)
    permanentRedirect(
      localizePath(
        mapDetailTabHref(ROUTES.MAP(region, detail.slug), tab),
        locale,
      ),
    );

  const available = availableMapTabs(await loadMapHistory(region, detail.slug));
  if (!available.includes(tab))
    redirect(
      localizePath(
        mapDetailTabHref(ROUTES.MAP(region, detail.slug), available[0]),
        locale,
      ),
    );

  return detail;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, region, slug } = await params;
  return mapMetadata(region, slug, MapDetailTab.Videos, locale);
}

export default async function MapVideosPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}) {
  const { locale, region, slug } = await params;
  if (!isRegion(region)) notFound();
  const detail = await loadMapTab(region, slug, MapDetailTab.Videos, locale);
  const videos = await loadMapVideos(region, detail.slug);

  // The panel names the map in its own heading, so the arena's name is resolved
  // here rather than handed down as the catalogue's English.
  const { t: tMaps } = await getTranslation("game/maps", locale);

  return (
    <MapVideosPanel
      region={region}
      map={{ ...detail, name: mapName(detail.arenaId, detail.name, tMaps) }}
      initialVideos={videos}
    />
  );
}
