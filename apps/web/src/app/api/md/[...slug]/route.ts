import { encodingForModel } from "js-tiktoken";
import { parse } from "node-html-parser";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

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

  if (pathPart === "/") return `/index.md${suffix}`;

  const clean = pathPart.endsWith("/") ? pathPart.slice(0, -1) : pathPart;
  const lastSegment = clean.slice(clean.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return href;

  return `${clean}.md${suffix}`;
}

/**
 * Markdown rendering of any page. Reached via `proxy.ts`, which rewrites a
 * `.md` suffix or an `Accept: text/markdown` request to `/api/md/<path>`.
 *
 * We re-fetch the page over HTTP and convert its `#page-content` container
 * (the layout wraps `{children}` in it) so nav and footer never leak in.
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

  // Use localhost so the self-fetch never routes through Cloudflare or any
  // external network. The public URL hairpins through the CDN and fails in
  // production (Railway containers cannot reliably reach themselves via the
  // public hostname). PORT is set by Railway; 3000 is the Next.js default.
  const port = process.env.PORT ?? 3000;
  const origin = `http://localhost:${port}`;

  let response: Response;
  try {
    response = await fetch(`${origin}/${path}${search}`, {
      headers: { Accept: "text/html" },
      cache: "no-store",
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  if (!response.ok) {
    return new Response("Page not found", { status: 404 });
  }

  const html = await response.text();
  const content = parse(html).querySelector("#page-content");

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

  const markdown = turndown.turndown(content.innerHTML);

  const headers: Record<string, string> = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    // The `.md` twin is a duplicate of the HTML page, meant for AI tools that
    // fetch it directly (the "Open in ChatGPT/Claude/…" deep links). Keep it out
    // of the search index so it never competes with the canonical HTML page;
    // `nofollow` stops crawlers from walking the `.md`→`.md` link tree.
    "X-Robots-Tag": "noindex, nofollow",
  };
  const tokenCount = countTokens(markdown);
  if (tokenCount !== null) headers["x-markdown-tokens"] = String(tokenCount);

  return new Response(markdown, { headers });
}
