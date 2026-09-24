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
 * anchors and other schemes (`mailto:`, …) untouched. A path that already
 * carries a file extension (`/sitemap.xml`, an existing `.md`) keeps its own
 * address rather than gaining a second `.md`. Query strings and hashes are
 * preserved.
 *
 * Every internal link comes out ABSOLUTE. This document is read away from the
 * site that serves it: a model is handed the text and nothing says what host
 * the paths in it hang off, so a reader that wants to follow one has to
 * rebuild the address itself. Claude's will not open an address it worked out
 * rather than read (its fetch tool takes only URLs present in the context),
 * so `/llms.txt` at the foot of every page — a link WE put there — failed for
 * it while the file answered 200 to everything else. Relative links cost a
 * browser nothing and cost these readers the link.
 */
function toMarkdownHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  const splitAt = href.search(/[?#]/);
  const pathPart = splitAt === -1 ? href : href.slice(0, splitAt);
  const suffix = splitAt === -1 ? "" : href.slice(splitAt);

  const clean = pathPart.endsWith("/") ? pathPart.slice(0, -1) : pathPart;
  const lastSegment = clean.slice(clean.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return `${APP.URL}${href}`;

  return `${APP.URL}${markdownPath(pathPart)}${suffix}`;
}

/**
 * An asset's address, made absolute for the reason the links above are: the
 * document is read away from the host that serves it, so a path alone names
 * nothing a reader can fetch.
 *
 * Unlike a link, an image is not pointed at a Markdown twin, having none, so
 * this only adds the origin. `/_next/image?url=...` is left as the address it
 * is: that is the optimizer the page itself points at, it answers any caller,
 * and rewriting it to the source it wraps would publish an address the page
 * does not use. Anything already absolute, protocol-relative or a `data:` URI
 * is left alone.
 */
function toAbsoluteSrc(src: string): string {
  if (!src.startsWith("/") || src.startsWith("//")) return src;
  return `${APP.URL}${src}`;
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
    `- [llms.txt](${APP.URL}/llms.txt): the API, the MCP server and the other machine-readable surfaces.`,
    `- [llms-full.txt](${APP.URL}/llms-full.txt): the same, with every endpoint's parameters inline.`,
    `- [sitemap.md](${APP.URL}/sitemap.md): every section of the site, down to the individual pages.`,
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
  asked: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    // Markdown to a reader that asked for Markdown, plain text to one that
    // only asked for the `.md` address. Both get the same bytes.
    "Content-Type": asked
      ? "text/markdown; charset=utf-8"
      : "text/plain; charset=utf-8",
    "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    // The type depends on what was asked for, and these are cached for an
    // hour at the edge: without this a reader would be served the variant
    // built for the other one.
    Vary: "Accept",
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

// A page can send the reader somewhere else before it answers: a tank asked
// for by numeric id or in the wrong case goes to its canonical slug, a tab a
// tank has nothing for falls back to the first one it has. Three redirects is
// more than any of those chains.
const MAX_HOPS = 3;

/**
 * The page behind a URL, following the redirects it answers with.
 *
 * `fetch` is asked NOT to follow them and they are followed here instead,
 * because what a redirect leaves behind matters: the query string. A page
 * redirects to a path alone (`/eu/tanks/is-7`), so a `?setup=...` or a `?tab=`
 * asked for would be dropped by an automatic follow, and the Markdown would be
 * of a different page than the one requested. It is carried over here.
 *
 * A relative `Location` is what the site's own redirects send, which is why
 * each hop is resolved against the URL it came from.
 */
async function fetchFollowing(url: string, accept: string): Promise<Response> {
  let at = url;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const response = await fetch(at, {
      headers: { Accept: accept },
      cache: "no-store",
      redirect: "manual",
    });
    const location = response.headers.get("location");
    if (!location || response.status < 300 || response.status >= 400) {
      return response;
    }
    const next = new URL(location, at);
    if (!next.search) next.search = new URL(at).search;
    at = next.toString();
  }
  return new Response(null, { status: 508 });
}

/**
 * Whether the reader asked for Markdown itself, rather than for the address.
 *
 * `Accept: text/markdown` is a reader saying it reads Markdown, so it is
 * answered with `text/markdown`, which is what the convention asks of a page
 * serving agents and what a conformance check looks for.
 *
 * The `.md` suffix says nothing of the sort: it is a path, and the reader
 * behind it may have no idea what to do with that type. ChatGPT's does not --
 * it refuses the response as non-renderable and reports a bare "failed to
 * fetch" -- and it is one of the readers this mod's links are handed to. A
 * path alone is therefore answered as plain text, which every reader takes.
 */
function wantsMarkdownType(request: Request): boolean {
  return (request.headers.get("accept") || "").includes("text/markdown");
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
    response = await fetchFollowing(
      `${origin}/${path}${sitemap ? ".xml" : ""}${search}`,
      sitemap ? "application/xml" : "text/html",
    );
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
    return new Response(markdown, {
      headers: markdownHeaders(markdown, null, wantsMarkdownType(request)),
    });
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

  // And the pictures with them, or a reader is handed a vehicle's render, its
  // nation and its class as paths off a host the document never names.
  for (const image of content.querySelectorAll("img[src]")) {
    const src = image.getAttribute("src");
    if (src) image.setAttribute("src", toAbsoluteSrc(src));
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
    headers: markdownHeaders(markdown, `/${path}`, wantsMarkdownType(request)),
  });
}
