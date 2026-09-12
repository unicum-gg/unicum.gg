import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, permanentRedirect } from "next/navigation";
import type { MapDetail } from "@unicum.gg/shared";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import { UnicumError } from "@unicum.gg/sdk";
import { MapView } from "@/components/maps/detail/view";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { mapDescription, mapName } from "@/components/game-name";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import { buildSafe, unicum } from "@/services/sdk";

// ISR, not dynamic: the whole page is rendered and cached, so a navigation
// serves prerendered HTML. Pages generate on first request (no
// generateStaticParams for the ~50 slugs) and revalidate on the map data's
// patch cadence. The SDK loopback covers any build-time prerender.
export const dynamic = "force-static";
export const revalidate = 3600;

async function loadDetail(
  region: Region,
  slug: string,
): Promise<MapDetail | null> {
  try {
    return (await unicum.region(region).maps(slug).detail()) as MapDetail;
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, region, slug } = await params;
  if (!isRegion(region)) return {};
  const detail = await loadDetail(region, slug).catch(() => null);
  if (!detail) return {};
  const regionLabel = region.toUpperCase();
  const modes = detail.geometry.map((g) => g.label).join(", ");
  const { t } = await getTranslation("app/maps/detail/page", locale);
  // The game's own name for the arena, so the tab and the search result read
  // like the client the visitor plays. Same source as the page body's heading.
  const { t: tMaps } = await getTranslation("game/maps", locale);
  const { t: tBlurbs } = await getTranslation("game/map-descriptions", locale);
  const name = mapName(detail.arenaId, detail.name, tMaps);
  return constructMetadata({
    locale,
    title: t("title", { map: name, region: regionLabel }),
    description:
      mapDescription(detail.arenaId, detail.description, tBlurbs) ||
      t(modes ? "description-modes" : "description", {
        map: name,
        width: detail.widthMeters,
        height: detail.heightMeters,
        modes,
      }),
    ogImage: `/api/og/${region}/maps/${encodeURIComponent(detail.slug)}`,
    canonical: ROUTES.MAP(region, detail.slug),
  });
}

export default async function MapDetailPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}) {
  const { locale, region, slug } = await params;
  if (!isRegion(region)) notFound();
  return renderMapPage(region, slug, locale);
}

export async function renderMapPage(
  region: Region,
  slug: string,
  locale: string,
) {
  const detail = await loadDetail(region, slug);
  if (!detail) notFound();
  // Redirect a legacy / non-canonical slug (or a bare arena id) onto the pretty
  // one, so the canonical and OG always point at a single URL.
  if (detail.slug !== slug)
    permanentRedirect(localizePath(ROUTES.MAP(region, detail.slug), locale));

  // Rendered here rather than fetched by the browser: the tactics belong in the
  // HTML, which is what the `.md` twin converts and what a crawler reads. An
  // approved tactic drops this page from the cache (`revalidatePath`), so
  // rendering it server-side costs no freshness.
  const [videos, history] = await Promise.all([
    buildSafe(() => unicum.region(region).maps(detail.slug).videos(), {
      videos: [],
    }),
    // Rendered server-side for the same reason as the tactics: what an update
    // changed about a map is content, and it belongs in the HTML a crawler and
    // the `.md` twin read. Degrades to no panel rather than no page.
    buildSafe(() => unicum.region(region).maps(detail.slug).history(), null),
  ]);

  // Resolved here, on the server: the blurbs are 20 KB the browser would carry
  // on every page of the site to render one of them here (see
  // `SERVER_ONLY_NAMESPACES`). The name stays a client lookup, since it is two
  // kilobytes and the gallery's search box matches on it.
  const { t: tBlurbs } = await getTranslation("game/map-descriptions", locale);
  const described = {
    ...detail,
    description: mapDescription(detail.arenaId, detail.description, tBlurbs),
  };

  return (
    <MapView
      detail={described}
      region={region}
      videos={videos.videos as unknown as TankVideoCardData[]}
      history={history}
    />
  );
}
