import { TOOL_DEFS } from "@/services/mcp/tools";

/**
 * The browser-side tool catalogue, as one cacheable file.
 *
 * It used to be inlined into every page by `components/script/webmcp`, which is
 * what a catalogue of 130 endpoints costs when it is carried rather than
 * fetched: measured 2026-11-18 on the lightest page of the site, 102,419 octets
 * of 213,891, or **48% of the page**, counted twice because Next repeats a
 * server-rendered script in the RSC payload beside the markup. Every page in
 * every language paid it, and so did every entry of the ISR cache, where the
 * same bytes sat ~2,761 times over for about 283 MB of a 4 GiB store.
 *
 * Here it is one address the browser fetches once and reuses for the whole
 * visit, and one entry at the edge for the whole site.
 *
 * Derived from the generated OpenAPI document at module load, so it only ever
 * changes with a deploy. The cache window is short all the same: a stale
 * catalogue would offer an agent a tool for an endpoint that no longer exists,
 * and ten minutes of that is a tolerable cost where a day would not be.
 */
export function GET(): Response {
  return new Response(JSON.stringify(TOOL_DEFS), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
    },
  });
}
