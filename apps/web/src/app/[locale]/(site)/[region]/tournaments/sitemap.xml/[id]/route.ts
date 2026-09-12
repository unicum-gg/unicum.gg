import { generateSitemapXml } from "@onruntime/next-sitemap";
import { asc, sql } from "drizzle-orm";
import ROUTES from "@/constants/routes";
import { buildSafe } from "@/services/sdk";
import { db } from "@unicum.gg/core/db";
import { tournamentsByRegion } from "@unicum.gg/shared";
import { createSitemapEntry, URLS_PER_SITEMAP } from "@/services/sitemap";
import { isRegion } from "@unicum.gg/wargaming";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * The tournament pages, paginated like the clan and player sitemaps.
 *
 * Only the ones we have MIRRORED (`detail_synced_at` is set): a catalogue row
 * whose bracket has not been read yet renders an empty page, and offering that
 * to a crawler is offering a page with nothing on it.
 *
 * Ordered newest first so the pages a reader is most likely to want sit in the
 * first files, and so a growing archive appends rather than reshuffling every
 * URL between sitemaps on each new tournament.
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

  const tournaments = tournamentsByRegion[region];
  // `buildSafe` like every other prerendered sitemap: these are `force-static`,
  // so a database hiccup during `next build` would fail the whole build rather
  // than this one file.
  const rows = await buildSafe(
    () =>
      db
        .select({
          id: tournaments.id,
          detailSyncedAt: tournaments.detailSyncedAt,
        })
        .from(tournaments)
        .where(sql`${tournaments.detailSyncedAt} IS NOT NULL`)
        // By id, like the clan and player sitemaps, and NOT by date: paging
        // with OFFSET over a newest-first order reshuffles every file each time
        // a tournament is mirrored, since the new row sorts to position 0 and
        // shifts everything after it. Ascending ids only ever append.
        .orderBy(asc(tournaments.id))
        .offset(sitemapId * URLS_PER_SITEMAP)
        .limit(URLS_PER_SITEMAP),
    [],
  );

  if (rows.length === 0) {
    return new Response("Sitemap not found", { status: 404 });
  }

  const entries = rows.map((row) =>
    createSitemapEntry(ROUTES.TOURNAMENT(region, Number(row.id)), {
      lastModified: row.detailSyncedAt ?? undefined,
    }),
  );

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
