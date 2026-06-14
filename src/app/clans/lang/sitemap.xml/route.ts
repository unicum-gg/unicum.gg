import { generateSitemapXml } from "@onruntime/next-sitemap";
import ROUTES from "@/constants/routes";
import { getAvailableLanguages } from "@/services/clans/available-languages";
import { createSitemapEntry } from "@/services/sitemap";
import { REGIONS } from "@/services/wargaming/wot";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * One-shot sitemap for `/<region>/clans/lang/<code>` URLs. Hits
 * `getAvailableLanguages` per region at request time so the sitemap
 * reflects the actual languages declared in the DB rather than a static
 * constant that would drift. Output is well under the 25k URLs/sitemap
 * limit (max a few hundred entries), no pagination needed.
 */
export async function GET() {
  const perRegion = await Promise.all(
    REGIONS.map(async (region) => ({
      region,
      languages: await getAvailableLanguages(region),
    })),
  );

  const entries = perRegion.flatMap(({ region, languages }) =>
    languages.map((l) =>
      createSitemapEntry(ROUTES.CLANS_BY_LANGUAGE(region, l.code)),
    ),
  );

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
