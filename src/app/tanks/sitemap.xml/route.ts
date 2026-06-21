import { generateSitemapXml } from "@onruntime/next-sitemap";
import ROUTES from "@/constants/routes";
import { createSitemapEntry } from "@/services/sitemap";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import { REGIONS } from "@/services/wargaming/wot";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

/**
 * One-shot sitemap for the tank surface: the `/<region>/tanks` index plus
 * every `/<region>/tanks/<id>` detail page. Tank ids come from the per-region
 * vehicle catalogue (~700 each), so the total (~2.1k URLs + 3 indexes) sits
 * well under the 25k chunk limit and needs no pagination. Referenced from the
 * sitemap index as `/tanks/sitemap.xml`.
 */
export async function GET() {
  const perRegion = await Promise.all(
    REGIONS.map(async (region) => ({
      region,
      tankIds: Object.keys(await getVehicleEncyclopedia(region)),
    })),
  );

  const entries = perRegion.flatMap(({ region, tankIds }) => [
    createSitemapEntry(ROUTES.TANKS(region)),
    ...tankIds.map((id) => createSitemapEntry(ROUTES.TANK(region, id))),
  ]);

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=86400, stale-while-revalidate",
    },
  });
}
