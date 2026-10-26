import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion } from "@unicum.gg/wargaming";
import { loadMapStatistics } from "@/app/[locale]/(site)/[region]/maps/[slug]/detail";
import {
  loadMapTab,
  mapMetadata,
} from "@/app/[locale]/(site)/[region]/maps/[slug]/(detail)/page";
import { MapStatisticsTab } from "@/components/maps/detail/statistics";
import { MapDetailTab } from "@/components/maps/detail/tabs";
import { mapName } from "@/components/game-name";
import { getTranslation } from "@/lib/translations.server";

// The Statistics tab as its own route, so a render builds this tab alone (see
// tabs.ts). ISR on the vehicle Loadouts tab's window: a battle lands when a
// player's client next uploads, and nothing here watches for its own write.
// The mode switch is client state over markup this render already produced,
// so the page needs no searchParams. It only exists for a map with recorded
// battles (`availableMapTabs`); asked for on one without, `loadMapTab` sends
// the reader back to the first tab that does exist.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, region, slug } = await params;
  return mapMetadata(region, slug, MapDetailTab.Statistics, locale);
}

export default async function MapStatisticsPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}) {
  const { locale, region, slug } = await params;
  if (!isRegion(region)) notFound();
  const detail = await loadMapTab(region, slug, MapDetailTab.Statistics, locale);
  const modes = await loadMapStatistics(region, detail.slug, locale);

  // The panel names the map in its own heading, in the reader's language.
  const { t: tMaps } = await getTranslation("game/maps", locale);

  return (
    <MapStatisticsTab
      region={region}
      mapName={mapName(detail.arenaId, detail.name, tMaps)}
      modes={modes}
      locale={locale}
    />
  );
}
