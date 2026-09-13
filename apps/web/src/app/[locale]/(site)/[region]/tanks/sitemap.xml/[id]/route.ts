import { generateSitemapXml } from "@onruntime/next-sitemap";
import ROUTES from "@/constants/routes";
import {
  createLocalizedSitemapEntry,
  URLS_PER_SITEMAP,
} from "@/services/sitemap";
import { listTanks } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { isRegion } from "@unicum.gg/wargaming";

// Dynamic, not `force-static`, like the entity streams beside it: with the
// `hreflang` alternates every URL carries 36 more lines, and a static route is
// held in the ISR cache, which here is a 2 GiB Redis running `allkeys-lru`.
// The catalogue is the smallest of the four at ~4.6 MB, but it shares their
// shape and there is nothing to gain from holding it apart.
export const dynamic = "force-dynamic";

/**
 * Per-region `/<region>/tanks/<slug>` sitemap, paginated to mirror the clans and
 * players pattern (one stream per region so Google can crawl them in parallel).
 * The catalogue is small (~1200 tanks), so in practice each region is a single
 * page, but the pagination keeps the shape uniform and future-proof.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  if (!isRegion(region)) {
    return new Response("Invalid region", { status: 404 });
  }
  const sitemapId = parseInt(id, 10);
  if (Number.isNaN(sitemapId) || sitemapId < 0) {
    return new Response("Invalid sitemap ID", { status: 400 });
  }

  const tanks = await listTanks(region);
  const page = tanks.slice(
    sitemapId * URLS_PER_SITEMAP,
    (sitemapId + 1) * URLS_PER_SITEMAP,
  );

  if (page.length === 0) {
    return new Response("Sitemap not found", { status: 404 });
  }

  const entries = page.map((t) =>
    createLocalizedSitemapEntry(ROUTES.TANK(region, t.slug)),
  );

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      // A day, not an hour, like the streams beside it. The catalogue is
      // already cached in memory per region, so what this saves is the
      // rendering rather than a query.
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
