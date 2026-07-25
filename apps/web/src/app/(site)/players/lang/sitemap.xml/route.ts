import { generateSitemapXml } from "@onruntime/next-sitemap";
import ROUTES from "@/constants/routes";
import { getPlayerLanguageStats } from "@/services/players/available-languages";
import { createSitemapEntry } from "@/services/sitemap";
import { REGIONS } from "@unicum.gg/wargaming";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * One-shot sitemap for `/<region>/players/lang/<code>` URLs. ISR (static +
 * hourly revalidate): cached and rebuilt in the background so crawler hits
 * don't re-run the per-region `getPlayerLanguageStats` scan every time. It
 * still reflects the inferred-language pool the leaderboard uses (top 10k by
 * WNX) rather than a static constant, refreshed once per revalidation window.
 * Output is small (max a few dozen languages × 3 regions), no pagination needed.
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
