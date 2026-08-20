import { generateSitemapXml } from "@onruntime/next-sitemap";
import ROUTES from "@/constants/routes";
import { getLanguageStats } from "@/services/clans/available-languages";
import { buildSafe } from "@/services/sdk";
import { createSitemapEntry } from "@/services/sitemap";
import { REGIONS } from "@unicum.gg/wargaming";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * One-shot sitemap for `/<region>/clans/lang/<code>` URLs. ISR (static +
 * hourly revalidate): the XML is cached and served from cache, rebuilt in the
 * background, so crawler hits don't re-run the per-region `getLanguageStats`
 * scan every time. It still derives the language list from the DB (rather than
 * a static constant that would drift), just once per revalidation window.
 * Output is well under the 25k URLs/sitemap limit (max a few hundred entries),
 * no pagination needed.
 */
export async function GET() {
// Wrapped in `buildSafe` like every other prerendered route: these are
// `force-static`, so a database hiccup during `next build` fails the whole
// build rather than the one file. Degrading here yields an empty sitemap that
// the first revalidation refills, and at runtime the error still propagates.
  const perRegion = await buildSafe(
    () =>
      Promise.all(
        REGIONS.map(async (region) => ({
          region,
          languages: await getLanguageStats(region),
        })),
      ),
    [] as { region: (typeof REGIONS)[number]; languages: { code: string }[] }[],
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
