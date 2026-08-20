import { generateSitemapXml } from "@onruntime/next-sitemap";
import { GLOSSARY_CATEGORIES } from "@unicum.gg/shared";
import { listGlossarySlugs } from "@/services/glossary";
import ROUTES from "@/constants/routes";
import { createSitemapEntry } from "@/services/sitemap";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * The glossary in one file: the index, the twelve section hubs and every term.
 *
 * Region-less, unlike the entity sitemaps, because a definition is the same on
 * every server. A few hundred URLs that only change on a deploy, so one
 * non-paginated file is plenty and route auto-discovery cannot produce it (the
 * terms are a catch-all segment).
 */
export function GET() {
  const entries = [
    createSitemapEntry(ROUTES.GLOSSARY),
    ...GLOSSARY_CATEGORIES.map((category) =>
      createSitemapEntry(ROUTES.GLOSSARY_CATEGORY(category)),
    ),
    ...listGlossarySlugs().map((slug) =>
      createSitemapEntry(ROUTES.GLOSSARY_TERM(slug)),
    ),
  ];

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
