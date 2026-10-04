import { notFound } from "next/navigation";
import { isRegion } from "@unicum.gg/wargaming";
import { MapShell } from "@/components/maps/detail/shell";
import { mapDescription } from "@/components/game-name";
import { getTranslation } from "@/lib/translations.server";
import {
  availableMapTabs,
  loadMapDetail,
  loadMapHistory,
  loadMapVideos,
  mapTabCounts,
} from "@/app/[locale]/(site)/[region]/maps/[slug]/detail";

/**
 * What every tab of a map page shares: the name, the minimap and the tab bar.
 *
 * A layout rather than three copies of the same header, because Next keeps it
 * mounted across the segments below it: the view selected in the minimap (an
 * Onslaught layout, a Waffenträger variant) survives while the panel under it is
 * replaced. Rendered per tab, every navigation would reset it to Standard.
 *
 * It lives inside the `(detail)` route group so it covers the tabs and nothing
 * else, and the group changes no URL.
 *
 * The canonical-slug redirect is left to the pages: they know which tab they
 * are, and the redirect has to land on the same one.
 */
export default async function MapLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
  children: React.ReactNode;
}) {
  const { locale, region, slug } = await params;
  if (!isRegion(region)) notFound();

  const detail = await loadMapDetail(region, slug);
  if (!detail) notFound();

  // Both are read for the tab bar: `tracked` decides whether this map has a
  // History tab at all, and the two payloads carry the numbers beside the tab
  // names. The tabs themselves read the same calls, and Next memoizes them
  // within a render pass, so on the tab that needs one it is the same request.
  const [history, videos] = await Promise.all([
    loadMapHistory(region, detail.slug),
    loadMapVideos(region, detail.slug),
  ]);

  // Resolved on the server: the blurbs are 20 KB the browser would otherwise
  // carry on every page of the site to render one of them here (see
  // `SERVER_ONLY_NAMESPACES`). The name stays a client lookup, since it is two
  // kilobytes and the gallery's search box matches on it.
  const { t: tBlurbs } = await getTranslation("game/map-descriptions", locale);

  return (
    <MapShell
      detail={{
        ...detail,
        description: mapDescription(detail.arenaId, detail.description, tBlurbs),
      }}
      region={region}
      available={availableMapTabs(history)}
      counts={mapTabCounts(detail, videos, history)}
    >
      {children}
    </MapShell>
  );
}
