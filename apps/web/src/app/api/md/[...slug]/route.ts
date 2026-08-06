import { encodingForModel } from "js-tiktoken";
// Aliased: `HTMLElement` is also a DOM global, and the two are unrelated types.
import { parse, type HTMLElement as ParsedNode } from "node-html-parser";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { AGENT_DISCOVERY_LINK } from "@/constants/agent-discovery";
import APP from "@/constants/app";
import { markdownPath } from "@/lib/markdown-url";
import { selfOrigin } from "@/lib/self-origin";
import { isSitemapPath, sitemapToMarkdown } from "@/services/markdown/sitemap";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// The site is table-heavy (leaderboards, per-tank stats). The GFM plugin
// teaches Turndown to emit Markdown tables, strikethrough and task lists
// instead of dropping the `<table>` markup.
turndown.use(gfm);

// Pages embed JSON-LD and inline styles inside the content container; drop
// them so their raw payloads don't leak into the Markdown.
turndown.remove(["script", "style", "noscript"]);

// Build the tiktoken encoder once (it loads a large BPE rank table) and reuse
// it. Token counting is best-effort: the `x-markdown-tokens` header is
// optional, so a failure here must never break the Markdown response.
let encoder: ReturnType<typeof encodingForModel> | null = null;
function countTokens(text: string): number | null {
  try {
    encoder ??= encodingForModel("gpt-4o");
    return encoder.encode(text).length;
  } catch {
    return null;
  }
}

/**
 * Point an internal page link at its Markdown rendering so the document stays
 * navigable in Markdown. Leaves external links, protocol-relative URLs,
 * anchors, other schemes (`mailto:`, …) and paths that already carry a file
 * extension (`/sitemap.xml`, an existing `.md`) untouched. Query strings and
 * hashes are preserved.
 */
function toMarkdownHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  const splitAt = href.search(/[?#]/);
  const pathPart = splitAt === -1 ? href : href.slice(0, splitAt);
  const suffix = splitAt === -1 ? "" : href.slice(splitAt);

  const clean = pathPart.endsWith("/") ? pathPart.slice(0, -1) : pathPart;
  const lastSegment = clean.slice(clean.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return href;

  return `${markdownPath(pathPart)}${suffix}`;
}

/**
 * The entry points a Markdown reader has and a visitor does not, so they are in
 * no navbar and get a section of their own. Named after `llms.txt`'s own
 * `## Indexes`, which lists the same kind of thing.
 */
function indexesSection(): string {
  return [
    "## Indexes",
    "",
    "- [llms.txt](/llms.txt): the API, the MCP server and the other machine-readable surfaces.",
    "- [llms-full.txt](/llms-full.txt): the same, with every endpoint's parameters inline.",
    "- [sitemap.md](/sitemap.md): every section of the site, down to the individual pages.",
  ].join("\n");
}

/**
 * The site navigation, appended so a Markdown reader can move around the site
 * the way a visitor does. Read from the rendered navbar, the same way the page
 * body is read from `#page-content`, so it is whatever the page actually serves.
 */
function navigationSection(document: ParsedNode): string {
  // `#nd-nav` is the site chrome's navbar, `#nd-subnav` the one `/docs` brings
  // with its own layout. Both are fumadocs' header for their section.
  const nav =
    document.querySelector("#nd-nav") ?? document.querySelector("#nd-subnav");

  const seen = new Set<string>();
  const links: string[] = [];
  for (const anchor of nav?.querySelectorAll("a[href]") ?? []) {
    const href = anchor.getAttribute("href");
    // The link's accessible name, which is its label rather than everything it
    // renders: icon-only links (Discord, GitHub) have no text at all, and the
    // dropdown's cards render a description under their title.
    const text = anchor.getAttribute("aria-label")?.trim() || anchor.text.trim();
    if (!href || !text || seen.has(href)) continue;
    seen.add(href);
    links.push(`- [${text}](${toMarkdownHref(href)})`);
  }

  return links.length ? ["## Navigation", "", ...links].join("\n") : "";
}

/**
 * Headers for a Markdown response, given the HTML page it is the twin of (null
 * for a sitemap, which is nobody's duplicate).
 *
 * The duplicate is declared with a canonical `Link` header, the mechanism Google
 * documents for non-HTML documents, and NOT with `noindex`. That was the first
 * approach here and it was the wrong tool: `noindex` blocks a document from
 * being used at all, AI crawlers included, so it took the Markdown twins out of
 * exactly the hands they were written for. Google says as much: "We don't
 * recommend using noindex to prevent selection of a canonical page within a
 * single site, because it will completely block the page from Search."
 *
 * The canonical says the honest thing instead: read this, index the HTML.
 */
function markdownHeaders(
  markdown: string,
  canonicalPath: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    // Setting `Link` here replaces the one `next.config.ts` puts on every route,
    // so the discovery targets are appended rather than inherited (the config's
    // rule excludes these paths for that reason).
    Link: [
      canonicalPath && `<${APP.URL}${canonicalPath}>; rel="canonical"`,
      AGENT_DISCOVERY_LINK,
    ]
      .filter(Boolean)
      .join(", "),
  };
  const tokenCount = countTokens(markdown);
  if (tokenCount !== null) headers["x-markdown-tokens"] = String(tokenCount);
  return headers;
}

/**
 * Markdown rendering of any page. Reached via `proxy.ts`, which rewrites a
 * `.md` suffix or an `Accept: text/markdown` request to `/api/md/<path>`.
 *
 * We re-fetch the page over HTTP and convert its `#page-content` container
 * (the layout wraps `{children}` in it) so nav and footer never leak in.
 *
 * A `.md` whose path names a sitemap is the twin of the XML rather than of a
 * page, so `/sitemap.md` reads `/sitemap.xml` and `/eu/tanks/sitemap-0.md`
 * reads its own file. Same idea, different source format.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const path = slug[0] === "index" ? "" : slug.join("/");
  // Forward the query string (e.g. `?tab=tanks`) so the rendered page matches
  // what a `.md` link with query params asked for. The proxy rewrite preserves
  // it on the request URL; the self-fetch would otherwise always get defaults.
  const search = new URL(request.url).search;

  // Loopback so the self-fetch never routes through the CDN or any external
  // network (see `selfOrigin`).
  const origin = selfOrigin();
  const sitemap = isSitemapPath(`/${path}`);

  let response: Response;
  try {
    response = await fetch(`${origin}/${path}${sitemap ? ".xml" : ""}${search}`, {
      headers: { Accept: sitemap ? "application/xml" : "text/html" },
      cache: "no-store",
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  if (!response.ok) {
    return new Response("Page not found", { status: 404 });
  }

  if (sitemap) {
    const markdown = await sitemapToMarkdown(
      await response.text(),
      origin,
      `/${path}.xml`,
    );
    // No canonical: a sitemap's Markdown rendering duplicates an XML file, not
    // a page, and nothing else says what it says.
    return new Response(markdown, { headers: markdownHeaders(markdown, null) });
  }

  const html = await response.text();
  const document = parse(html);
  const content = document.querySelector("#page-content");

  if (!content) {
    return new Response("Page content not found", { status: 404 });
  }

  // Turndown's HTML parser drops `<svg>` elements entirely, so icon-only SVGs
  // that carry their meaning in `aria-label` (e.g. the rank medals for the top
  // 1/2/3) would vanish. Surface the label as text before conversion.
  for (const svg of content.querySelectorAll("svg[aria-label]")) {
    svg.replaceWith(`<span>${svg.getAttribute("aria-label")}</span>`);
  }

  // Keep internal navigation in Markdown: rewrite `<a href>` to the `.md` URL.
  for (const anchor of content.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (href) anchor.setAttribute("href", toMarkdownHref(href));
  }

  const markdown = [
    turndown.turndown(content.innerHTML),
    navigationSection(document),
    indexesSection(),
  ]
    .filter(Boolean)
    .join("\n\n");
  // The page this is a rendering of, without the query string, so it matches the
  // `canonical` its own metadata declares.
  return new Response(markdown, {
    headers: markdownHeaders(markdown, `/${path}`),
  });
}
