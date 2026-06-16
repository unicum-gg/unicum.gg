import { generateSitemapXml } from "@onruntime/next-sitemap";
import ROUTES from "@/constants/routes";
import { getPlayerLanguageStats } from "@/services/players/available-languages";
import { createSitemapEntry } from "@/services/sitemap";
import { REGIONS } from "@/services/wargaming/wot";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * One-shot sitemap for `/<region>/players/lang/<code>` URLs. Hits
 * `getPlayerLanguageStats` per region at request time so the sitemap
 * reflects the inferred-language pool the leaderboard actually uses
 * (top 10k by WNX) rather than a static constant. Output is small (max
 * a few dozen languages × 3 regions), no pagination needed.
 */
export async function GET() {
  const perRegion = await Promise.all(
    REGIONS.map(async (region) => ({
      region,
      languages: await getPlayerLanguageStats(region),
    })),
  );

  const entries = perRegion.flatMap(({ region, languages }) =>
    languages.map((l) =>
      createSitemapEntry(ROUTES.PLAYERS_BY_LANGUAGE(region, l.code)),
    ),
  );

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
