import { loader } from "fumadocs-core/source";
import { openapi } from "@/lib/openapi";

// Fumadocs Source for the API docs: virtual pages generated from the OpenAPI
// schema (one page per endpoint), so there is no committed MDX to maintain — the
// tree regenerates from `openapi.generated.json`. `groupBy: 'tag'` files each
// endpoint under its tag folder (`Clans/…`, `Players/…`, …) so the sidebar is
// sectioned like the old reference. `loaderPlugin()` adds the method badges.
// `slugs` lowercases + strips the `{param}` braces the operation paths carry so
// the URLs stay clean (`/docs/clans/get-region-clans-search`) instead of
// `%7B…%7D`.
// Tag folders are titled from the spec's `x-displayName`, which `normalizeDoc`
// pins to the tag name (see `services/openapi/normalize`). Without it fumadocs
// humanises the tag through `idToTitle`, which splits runs of capitals and
// turned `MCP` into "M C P" and `OG Images` into "O G Images".
const staticSource = await openapi.staticSource({ groupBy: "tag", meta: true });

export const source = loader({
  baseUrl: "/docs",
  source: staticSource,
  plugins: [openapi.loaderPlugin()],
  slugs: (info) =>
    info.path
      .replace(/\.mdx?$/, "")
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.replace(/[{}]/g, "").toLowerCase()),
});

// Card descriptions are one-liners; trim the (sometimes multi-paragraph)
// endpoint descriptions at a word boundary so a card doesn't sprawl.
function truncate(s: string | undefined, max = 130): string | undefined {
  if (!s || s.length <= max) return s;
  return `${s.slice(0, max).replace(/\s+\S*$/, "").trimEnd()}…`;
}

export type DocsSection = {
  /** Display name, e.g. "Players" (the OpenAPI tag). */
  name: string;
  /** URL slug, e.g. "players" (tag lowercased; `/docs/{slug}`). */
  slug: string;
  description?: string;
  pages: { url: string; title: string; description?: string }[];
};

/**
 * The docs grouped by tag section (Players, Clans, …), in the tag order set by
 * `normalizeDoc`. Powers the `/docs` overview cards and each `/docs/{tag}`
 * section landing (a card per endpoint). Sections come from the spec's `tags`
 * (name + description + order); their pages from the generated source, matched
 * on the first slug segment.
 */
export async function getDocsSections(): Promise<DocsSection[]> {
  const schemas = await openapi.getSchemas();
  const bundled = Object.values(schemas)[0]?.bundled as
    | { tags?: { name?: string; description?: string }[] }
    | undefined;
  const tags = bundled?.tags ?? [];
  const pages = source.getPages();
  return tags
    .map((tag) => {
      const slug = (tag.name ?? "").toLowerCase();
      const sectionPages = pages
        .filter((p) => p.slugs[0] === slug)
        .map((p) => {
          const data = p.data as { title?: string; description?: string };
          return {
            url: p.url,
            title: data.title ?? p.url,
            description: truncate(data.description),
          };
        });
      return {
        name: tag.name ?? slug,
        slug,
        description: tag.description,
        pages: sectionPages,
      };
    })
    .filter((section) => section.pages.length > 0);
}
