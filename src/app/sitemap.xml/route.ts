import { createSitemapIndexHandler } from "@onruntime/next-sitemap/app";
import {
  getSitemapCount,
  getSitemapCounts,
  sitemapConfig,
  URLS_PER_SITEMAP,
} from "@/services/sitemap";
import { REGIONS } from "@/services/wargaming/wot";

// Static-first, stale-while-revalidate on a 1h window. The pre-built XML
// serves every hit instantly; the first hit after 1h triggers a background
// rebuild so the next hit gets fresher counts. The rebuild is cheap (three
// COUNT(*) queries) but daily-ish freshness is plenty for a sitemap.
export const revalidate = 3600;

export async function GET() {
  const additionalSitemaps: (string | { pattern: string; count: number })[] = [
    // Languages live in a single non-paginated sub-sitemap: total entry
    // count is small (one URL per declared language per region) and
    // depends on `getAvailableLanguages` at request time so the list
    // tracks reality instead of a hardcoded constant.
    "/clans/lang/sitemap.xml",
  ];
  try {
    const counts = await getSitemapCounts();
    additionalSitemaps.push(
      ...REGIONS.flatMap((region) => [
        {
          pattern: `/${region}/clans/sitemap-{id}.xml`,
          count: getSitemapCount(counts[region].clans, URLS_PER_SITEMAP),
        },
        {
          pattern: `/${region}/players/sitemap-{id}.xml`,
          count: getSitemapCount(counts[region].players, URLS_PER_SITEMAP),
        },
      ]),
    );
  } catch (err) {
    console.warn("[sitemap] counts failed, falling back to empty:", err);
  }

  const { GET: handler } = createSitemapIndexHandler({
    ...sitemapConfig,
    additionalSitemaps,
  });
  return handler();
}
