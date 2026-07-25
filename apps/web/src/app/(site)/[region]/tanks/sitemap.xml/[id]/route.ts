import { generateSitemapXml } from "@onruntime/next-sitemap";
import ROUTES from "@/constants/routes";
import { createSitemapEntry, URLS_PER_SITEMAP } from "@/services/sitemap";
import { listTanks } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { isRegion } from "@unicum.gg/wargaming";

export const dynamic = "force-static";
export const revalidate = 3600;

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
    createSitemapEntry(ROUTES.TANK(region, t.slug)),
  );

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
