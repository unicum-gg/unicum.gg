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
export const source = loader({
  baseUrl: "/docs",
  source: await openapi.staticSource({ groupBy: "tag", meta: true }),
  plugins: [openapi.loaderPlugin()],
  slugs: (info) =>
    info.path
      .replace(/\.mdx?$/, "")
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.replace(/[{}]/g, "").toLowerCase()),
});
