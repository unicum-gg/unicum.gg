import { generateSitemapXml } from "@onruntime/next-sitemap";
import ROUTES from "@/constants/routes";
import { getDocsSections } from "@/lib/docs-source";
import { createSitemapEntry } from "@/services/sitemap";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * One-shot sitemap for the API reference: the overview, each tag's landing and
 * every endpoint page. These are real indexable pages, but route auto-discovery
 * cannot see them: `/docs/[[...slug]]` is a catch-all, and the tree is built
 * from the generated OpenAPI document rather than from files. A few dozen URLs,
 * so a single non-paginated file rebuilt hourly is plenty.
 */
export async function GET() {
  const sections = await getDocsSections();
  const entries = [
    createSitemapEntry(ROUTES.DOCS),
    ...sections.flatMap((section) => [
      createSitemapEntry(`${ROUTES.DOCS}/${section.slug}`),
      ...section.pages.map((page) => createSitemapEntry(page.url)),
    ]),
  ];

  return new Response(generateSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
