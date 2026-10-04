import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion } from "@unicum.gg/wargaming";
import { loadMapHistory } from "@/app/[locale]/(site)/[region]/maps/[slug]/detail";
import {
  loadMapTab,
  mapMetadata,
} from "@/app/[locale]/(site)/[region]/maps/[slug]/(detail)/page";
import { MapChangesHistory } from "@/components/maps/detail/history";
import { MapDetailTab } from "@/components/maps/detail/tabs";
import { mapDescription, mapName } from "@/components/game-name";
import { getTranslation } from "@/lib/translations.server";

// The History tab as its own route, so a render builds this tab alone instead
// of all of them (see tabs.ts). It only exists for a map we have recorded a
// version of (`availableMapTabs`); asked for on one we have not, `loadMapTab`
// sends the reader back to the first tab that does exist.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, region, slug } = await params;
  return mapMetadata(region, slug, MapDetailTab.History, locale);
}

export default async function MapHistoryPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}) {
  const { locale, region, slug } = await params;
  if (!isRegion(region)) notFound();
  const detail = await loadMapTab(region, slug, MapDetailTab.History, locale);
  const history = await loadMapHistory(region, detail.slug);
  // Unreachable through `loadMapTab`, which redirects a map with no history
  // away from this tab before we get here. Narrowed rather than asserted, since
  // the payload is allowed to be null when the endpoint could not be read.
  if (!history) notFound();

  // The panel names the map and prints its blurb, both in the reader's own
  // language. Resolved here for the same reason the layout resolves its own:
  // a server component has no request to read the language from.
  const { t: tMaps } = await getTranslation("game/maps", locale);
  const { t: tBlurbs } = await getTranslation("game/map-descriptions", locale);

  return (
    <MapChangesHistory
      detail={{
        ...detail,
        name: mapName(detail.arenaId, detail.name, tMaps),
        description: mapDescription(
          detail.arenaId,
          detail.description,
          tBlurbs,
        ),
      }}
      versions={history.versions}
      testVersion={history.testVersion}
      testChanges={history.testChanges}
      addedVersion={history.addedVersion}
      addedAt={history.addedAt}
      removedVersion={history.removedVersion}
      removedAt={history.removedAt}
      present={history.present}
      locale={locale}
    />
  );
}
