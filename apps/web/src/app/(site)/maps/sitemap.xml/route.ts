import { generateSitemapXml } from "@onruntime/next-sitemap";
import { listMapSlugs } from "@unicum.gg/core/wargaming/wot/maps";
import { REGIONS } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import { createSitemapEntry } from "@/services/sitemap";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * One-shot sitemap for the maps section: the per-region landing plus every
 * `/<region>/maps/<slug>` detail URL. The catalogue is small (~50 maps × 3
 * regions) and static between game patches, so a single non-paginated file
 * rebuilt hourly is plenty.
 */
export async function GET() {
  const perRegion = await Promise.all(
    REGIONS.map(async (region) => ({
      region,
      maps: await listMapSlugs(region),
    })),
  );

  const entries = perRegion.flatMap(({ region, maps }) => [
    createSitemapEntry(ROUTES.MAPS(region)),
    ...maps.map(({ slug }) => createSitemapEntry(ROUTES.MAP(region, slug))),
  ]);

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
