import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion } from "@unicum.gg/wargaming";
import { loadMapRatings } from "@/app/[locale]/(site)/[region]/maps/[slug]/detail";
import {
  loadMapTab,
  mapMetadata,
} from "@/app/[locale]/(site)/[region]/maps/[slug]/(detail)/page";
import { MapCommunityPanel } from "@/components/maps/detail/community";
import { MapDetailTab } from "@/components/maps/detail/tabs";
import { mapName } from "@/components/game-name";
import { getTranslation } from "@/lib/translations.server";

// The Community tab as its own route, so a render builds this tab alone instead
// of all of them (see tabs.ts). Same ISR settings as the default tab: the
// verdict is cached HTML, and a vote drops it from the cache through the rating
// endpoint's own `revalidatePath`, so a new star shows without waiting out the
// window. The form inside is a client component reading its own uncached state,
// which is what keeps one reader's vote out of everyone else's page.
//
// No review structured data here, unlike the vehicle twin, and the absence is
// deliberate. That one hangs its reviews off a `Product`, which a tank honestly
// is: it is sold, for gold or for credits. A map is neither a product nor a
// game, and the types Google will show a review snippet for are a closed list
// that holds nothing a battlefield fits. Picking one anyway would be claiming
// something false about the page to win a star in a search result.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, region, slug } = await params;
  return mapMetadata(region, slug, MapDetailTab.Community, locale);
}

export default async function MapCommunityPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}) {
  const { locale, region, slug } = await params;
  if (!isRegion(region)) notFound();
  const [detail, summary] = await Promise.all([
    loadMapTab(region, slug, MapDetailTab.Community, locale),
    loadMapRatings(region, slug),
  ]);

  // Wargaming's own name for the arena, in the reader's language: the panel
  // heads itself with it, and a server component has no request to read the
  // language from.
  const { t: tMaps } = await getTranslation("game/maps", locale);

  return (
    <MapCommunityPanel
      region={region}
      slug={detail.slug}
      mapName={mapName(detail.arenaId, detail.name, tMaps)}
      summary={summary}
      locale={locale}
    />
  );
}
