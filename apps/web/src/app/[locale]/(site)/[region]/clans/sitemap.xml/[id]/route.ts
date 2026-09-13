import { generateSitemapXml } from "@onruntime/next-sitemap";
import { asc } from "drizzle-orm";
import ROUTES from "@/constants/routes";
import { db } from "@unicum.gg/core/db";
import { clansByRegion } from "@unicum.gg/shared";
import {
  createLocalizedSitemapEntry,
  URLS_PER_SITEMAP,
} from "@/services/sitemap";
import { isRegion } from "@unicum.gg/wargaming";

// Dynamic, not `force-static`, and the one reason is its size: with the
// `hreflang` alternates every URL carries 36 more lines, so a file runs to
// ~18 MB. A static route is held in the ISR cache, which here is a 2 GiB Redis
// running `allkeys-lru`, and the entity streams together would be several GB of
// it, evicting the pages and the Wargaming payloads that share the store. The
// CDN caches the bytes instead, on the header below.
export const dynamic = "force-dynamic";

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

  const clans = clansByRegion[region];
  const rows = await db
    .select({
      tag: clans.tag,
      lastRefreshedAt: clans.lastRefreshedAt,
    })
    .from(clans)
    .orderBy(asc(clans.id))
    .offset(sitemapId * URLS_PER_SITEMAP)
    .limit(URLS_PER_SITEMAP);

  if (rows.length === 0) {
    return new Response("Sitemap not found", { status: 404 });
  }

  const entries = rows.map((row) =>
    createLocalizedSitemapEntry(ROUTES.CLAN(region, row.tag), {
      lastModified: row.lastRefreshedAt ?? undefined,
    }),
  );

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      // A day, not an hour, and it is the CDN's copy that decides how often
      // this runs now: paging with OFFSET into the clan table and rendering
      // ~18 MB is not something a crawler hit should pay for, and a clan that
      // appears in the sitemap a day late loses nothing.
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
