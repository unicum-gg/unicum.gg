import { generateSitemapXml, pathsToEntries } from "@onruntime/next-sitemap";
import {
  getSitemapCount,
  sectionPaths,
  sitemapConfig,
  URLS_PER_SITEMAP,
} from "@/services/sitemap";

export const dynamic = "force-static";

export function generateStaticParams() {
  const count = getSitemapCount(sectionPaths().length);
  return Array.from({ length: count }, (_, id) => ({ id: String(id) }));
}

/**
 * The section pages, one entry each, carrying the `hreflang` alternates that
 * name all 36 translations. Paginated like the entity streams even though the
 * whole list is a few dozen URLs, so the index's `/sitemap-{id}.xml` pattern
 * means the same thing everywhere.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const start = Number.parseInt(id, 10) * URLS_PER_SITEMAP;
  const paths = sectionPaths().slice(start, start + URLS_PER_SITEMAP);

  return new Response(
    generateSitemapXml(pathsToEntries(paths, sitemapConfig)),
    { headers: { "Content-Type": "application/xml" } },
  );
}
