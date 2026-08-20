import { generateSitemapXml } from "@onruntime/next-sitemap";
import { asc } from "drizzle-orm";
import ROUTES from "@/constants/routes";
import { buildSafe } from "@/services/sdk";
import { db } from "@unicum.gg/core/db";
import { playersByRegion } from "@unicum.gg/shared";
import {
  createSitemapEntry,
  URLS_PER_SITEMAP,
} from "@/services/sitemap";
import { isRegion } from "@unicum.gg/wargaming";

export const dynamic = "force-static";
export const revalidate = 3600;

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

  const players = playersByRegion[region];
  // Wrapped in `buildSafe` like every other prerendered route: these are
  // `force-static`, so a database hiccup during `next build` fails the whole
  // build rather than the one file. Degrading here yields a 404 for one
  // revalidation window, and at runtime the error still propagates.
  const rows = await buildSafe(
    () =>
      db
        .select({
          nickname: players.nickname,
          lastSeenAt: players.lastSeenAt,
        })
        .from(players)
        .orderBy(asc(players.id))
        .offset(sitemapId * URLS_PER_SITEMAP)
        .limit(URLS_PER_SITEMAP),
    [],
  );

  if (rows.length === 0) {
    return new Response("Sitemap not found", { status: 404 });
  }

  const entries = rows.map((row) =>
    createSitemapEntry(ROUTES.PLAYER(region, row.nickname), {
      lastModified: row.lastSeenAt,
    }),
  );

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
