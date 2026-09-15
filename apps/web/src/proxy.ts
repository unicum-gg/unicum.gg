import { NextResponse, type NextRequest } from "next/server";
import PAGINATION from "@/constants/pagination";
import STORAGE from "@/constants/storage";
import { parsePageNumber } from "@/lib/page-number";
import { matchesAnyRoute } from "@/lib/route-match";
import {
  DEFAULT_LOCALE,
  getPreferredLocale,
  localizePath,
  splitLocale,
} from "@/lib/translations";
import {
  PAGINATED_PAGES,
  REGIONAL_PAGES,
  REGIONLESS_HANDLERS,
  REGIONLESS_PAGES,
  ROOT_HANDLERS,
  UNLOCALIZED_PAGES,
} from "@/proxy-routes.generated";
import { isRegion, Region } from "@unicum.gg/wargaming";

const PATHNAME_HEADER = "x-pathname";
const LOCALE_HEADER = "x-locale";
/** `/{region}/tanks/{id}` with digits for an id, optionally followed by a tab.
 * The locale prefix is already off `rest` by the time this is tested. */
const NUMERIC_TANK = /^\/(?:eu|na|asia)\/tanks\/\d+(?:\/[a-z-]+)?$/;

/**
 * Where a region-less URL stands, given the pages that actually exist. Both
 * lists are derived from the filesystem by `scripts/generate-page-routes.ts`,
 * so a section added or a shortcut removed changes this behaviour by existing.
 * Nothing below enumerates a path by hand.
 */
function regionlessKind(pathname: string): "served" | "needs-region" | "other" {
  // A sitemap or a text file is not a page: leave it where it is, even when a
  // sibling `[slug]` pattern would match it (`/maps/sitemap.xml`).
  if (matchesAnyRoute(pathname, REGIONLESS_HANDLERS)) return "other";
  if (!matchesAnyRoute(pathname, REGIONAL_PAGES)) return "other";
  // A catalogue (`/tanks`, `/players`) has a page of its own AND a regional
  // twin; an item (`/tanks/is-7`, `/players/Straik`) only has the twin.
  return matchesAnyRoute(pathname, REGIONLESS_PAGES) ? "served" : "needs-region";
}

/**
 * A sitemap's public address is file-like, so its pages read `sitemap-3.xml`
 * while App Router can only name a dynamic segment as a whole folder
 * (`…/sitemap.xml/[id]`). The mapping used to be a `next.config` rewrite, which
 * runs AFTER this proxy: once the locale port started prefixing every path, the
 * pattern no longer matched anything and every paginated sitemap 404ed, the
 * section one carrying the `hreflang` alternates included.
 *
 * It is answered here rather than restored there because the two cannot be kept
 * apart: whatever rewrites a sitemap has to agree with whatever adds the locale
 * prefix, and only one of them can run first.
 */
const PAGINATED_SITEMAP = /^(.*)\/sitemap-(\d+)\.xml$/;

/**
 * The route behind a sitemap URL, or null when the path is not one.
 *
 * A sitemap is read by a crawler and lists absolute URLs it builds itself, so
 * it has ONE address and one language: serving it per visitor would publish the
 * same file at 36 of them and let a CDN cache a redirect onto a file whose
 * whole job is to be fetched by machines that never negotiate.
 */
function sitemapRoute(pathname: string): string | null {
  const paginated = PAGINATED_SITEMAP.exec(pathname);
  if (!paginated && !pathname.endsWith("/sitemap.xml")) return null;
  const route = paginated
    ? `${paginated[1]}/sitemap.xml/${paginated[2]}`
    : pathname;
  // The index and its pages live beside `app/[locale]`; a section's lives
  // inside it, and is served in the language the entries are written in.
  return matchesAnyRoute(route, ROOT_HANDLERS)
    ? route
    : `/${DEFAULT_LOCALE}${route}`;
}

/**
 * Where page N of a list is served from, or null when nothing serves one.
 *
 * A page of a table is `?page=N` to everyone outside: it is what Google
 * documents, it is what a reader can paste, and it keeps a section at one path
 * whatever page of it they are on. A statically rendered page cannot read a
 * query param though (`force-static` hands back an empty one, deliberately), so
 * the page would only appear after hydration, which is precisely what a crawler
 * does not wait for. So the query form is resolved here onto a route that names
 * the page as a segment, exactly as `sitemap-3.xml` is resolved onto
 * `sitemap.xml/[id]`, and for the same reason: App Router can only name a
 * dynamic value as a folder.
 *
 * The alternative was to let the section read `searchParams`, which turns the
 * whole route dynamic for every reader, first page included. These are the most
 * visited pages on the site and most of what reaches them is a crawler, so the
 * cost of that would have been real and permanent, where this one is one
 * cache entry per page anybody actually asks for.
 */
function paginatedRoute(rest: string, search: URLSearchParams): string | null {
  const page = parsePageNumber(search.get(PAGINATION.PARAM));
  if (page === null) return null;
  const route = `${rest === "/" ? "" : rest}/${PAGINATION.SEGMENT}/${page}`;
  return matchesAnyRoute(route, PAGINATED_PAGES) ? route : null;
}

/**
 * A section's own address, given one of its `/page/<n>` routes.
 *
 * Those are internal: the reader's URL is the query form, and this is the half
 * that keeps it that way. Without it the same page of the same list would be
 * served at two addresses, which is the duplicate a canonical is supposed to be
 * resolving rather than creating.
 */
function pageSegmentRedirect(
  rest: string,
): { pathname: string; page: number | null } | null {
  if (!matchesAnyRoute(rest, PAGINATED_PAGES)) return null;
  const segments = rest.split("/");
  const page = parsePageNumber(segments.at(-1));
  // Drop `/page/<n>`; a first page (or an unparseable one) goes to the bare
  // section, since that is the address it already has.
  return { pathname: `/${segments.slice(1, -2).join("/")}`, page };
}

/**
 * A redirect decided from who is asking, not from the URL.
 *
 * The region and the locale redirects both read a cookie, and the locale one
 * additionally reads `Accept-Language`, so the same address answers differently
 * per visitor. The site serves HTML through a CDN cache rule, and a cached 307
 * is the worst possible outcome here: one German first-time visitor would pin
 * `/tanks` to `/de/tanks` for everyone behind that cache, English readers
 * included. `Vary` names both inputs and `private` keeps it out of any shared
 * cache at all, which is the guarantee that matters, since `Vary: Cookie` is
 * effectively uncacheable anyway and not every cache honours it the same way.
 */
function perVisitorRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("Vary", "Cookie, Accept-Language");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * Send a page to the Markdown converter, keeping the address it was asked at.
 *
 * The slug keeps the locale prefix, so the page the route fetches back is the
 * one in the language that was asked for.
 */
function markdownRewrite(
  req: NextRequest,
  pathname: string,
  isMdSuffix: boolean,
): NextResponse {
  const clean = isMdSuffix ? pathname.slice(0, -".md".length) : pathname;
  const slug = clean === "/" || clean === "" ? "index" : clean.replace(/^\//, "");
  const url = req.nextUrl.clone();
  url.pathname = `/api/md/${slug}`;
  return NextResponse.rewrite(url);
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Everything that is not a page: the API, `robots.txt`, the sitemap index,
  // `llms.txt`, the agent discovery files. They live outside `app/[locale]`, so
  // prefixing them would point at a route that does not exist, and they carry no
  // region. The API is matched by prefix rather than through the generated list
  // because the list deliberately excludes it: there are a hundred of them and
  // none is ever a page.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/.well-known/") ||
    matchesAnyRoute(pathname, ROOT_HANDLERS)
  ) {
    return NextResponse.next();
  }

  // The language the URL itself names, and what is left of it. The default
  // locale is served with no prefix, so a path carrying none is already in it.
  const { locale: pathLocale, rest, prefixed } = splitLocale(pathname);

  // `/en/tanks` is a second address for `/tanks`. Send it to the canonical one
  // rather than serving the same page twice: permanent, because unlike the
  // region below, which follows a cookie, this one is a property of the URL
  // and can never point somewhere else.
  if (prefixed && pathLocale === DEFAULT_LOCALE) {
    const url = req.nextUrl.clone();
    url.pathname = rest;
    return NextResponse.redirect(url, 308);
  }

  // A page of a list has one public address, `?page=N`, so the route that serves
  // it is sent back there and `?page=1` is sent to the bare section. Permanent,
  // like the `/en/` redirect above and unlike the region one: this is a property
  // of the URL rather than of who asked for it. Before everything below, so no
  // other rule ever sees an address that is about to stop existing.
  const fromSegment = pageSegmentRedirect(rest);
  if (fromSegment) {
    const url = req.nextUrl.clone();
    url.pathname = fromSegment.pathname;
    if (fromSegment.page === null) url.searchParams.delete(PAGINATION.PARAM);
    else url.searchParams.set(PAGINATION.PARAM, String(fromSegment.page));
    return NextResponse.redirect(url, 308);
  }
  const pageParam = req.nextUrl.searchParams.get(PAGINATION.PARAM);
  if (pageParam !== null && parsePageNumber(pageParam) === null) {
    const url = req.nextUrl.clone();
    url.searchParams.delete(PAGINATION.PARAM);
    return NextResponse.redirect(url, 308);
  }

  // A sitemap, at its one address: the `sitemap-N.xml` pages resolved onto the
  // route that serves them, a prefixed variant sent back to the bare path, and
  // neither the region nor the language redirect below ever reached.
  const sitemap = sitemapRoute(rest);
  if (sitemap) {
    if (prefixed) {
      const url = req.nextUrl.clone();
      url.pathname = rest;
      return NextResponse.redirect(url, 308);
    }
    const url = req.nextUrl.clone();
    url.pathname = sitemap;
    return NextResponse.rewrite(url);
  }

  // Serve a Markdown rendering of any page through two triggers: a `.md` suffix
  // on the URL (shareable, indexable) or an `Accept: text/markdown` header (for
  // agents and LLMs). Both rewrite to the `/api/md/[...slug]` route, which
  // re-fetches the page HTML and converts `#page-content`. The fetch it makes
  // carries `Accept: text/html`, so it never re-enters this branch.
  //
  // Decided HERE rather than where it is acted on, because the unlocalized
  // block below returns before it: `/docs` is a page like any other to an agent,
  // and answering its `Accept: text/markdown` with the HTML shell is worse than
  // not offering Markdown at all, since the caller has no way to tell.
  const accept = req.headers.get("accept") || "";
  const isMdSuffix = pathname.endsWith(".md");
  const isApiRoute = pathname.startsWith("/api/");
  // Files already served as plain text (`/llms.txt`, `/robots.txt`,
  // `/sitemap.xml`) are not pages, so there is no `#page-content` to convert.
  // Without this, an agent asking for `text/markdown` (exactly the kind of
  // client that fetches `/llms.txt`) would be rewritten into the converter and
  // get a 404 instead of the file.
  const isFile = /\.[^/.]+$/.test(pathname) && !isMdSuffix;
  const wantsMarkdown =
    !isApiRoute && !isFile && (isMdSuffix || accept.includes("text/markdown"));

  // A page that lives outside `app/[locale]` has one address in one language,
  // because there is nothing on it to translate: `/docs` is generated from the
  // OpenAPI document. Serve it as asked, and send a prefixed variant (a stale
  // link, a hand-typed URL) back to the bare path rather than 404ing it.
  if (matchesAnyRoute(rest, UNLOCALIZED_PAGES)) {
    if (prefixed) {
      const url = req.nextUrl.clone();
      url.pathname = rest;
      return NextResponse.redirect(url, 308);
    }
    if (wantsMarkdown) return markdownRewrite(req, pathname, isMdSuffix);
    // Two representations at one address, so a CDN must not serve the HTML to
    // the next caller asking for Markdown.
    const passthrough = NextResponse.next();
    passthrough.headers.set("Vary", "Accept");
    return passthrough;
  }

  // A prefix is the reader's answer for this URL. Without one, fall back to
  // what they have chosen before, then to what their browser advertises.
  const locale = prefixed ? pathLocale : getPreferredLocale(req);

  const stored = req.cookies.get(STORAGE.COOKIES.REGION)?.value;
  const region = stored && isRegion(stored) ? stored : Region.EU;

  const kind = regionlessKind(rest);
  // Send a region-less URL to its regional page when it has no page of its own
  // (an item: `/tanks/is-7`, `/players/Straik`, guessed constantly and a 404
  // until now), or when the visitor is not on EU and a regional twin exists (a
  // catalogue: `/tanks` for someone browsing NA).
  //
  // Temporary (307) on purpose: the destination follows the region cookie, so a
  // permanent redirect would let a browser pin a visitor to one region for good
  // after they switch.
  if (kind === "needs-region" || (kind === "served" && region !== Region.EU)) {
    const url = req.nextUrl.clone();
    url.pathname = localizePath(
      rest === "/" ? `/${region}` : `/${region}${rest}`,
      locale,
    );
    return perVisitorRedirect(url);
  }

  // Runs after the region redirect so a `.md` request is region-normalized
  // first, and the page the converter fetches back is the regional one.
  if (wantsMarkdown) return markdownRewrite(req, pathname, isMdSuffix);

  // A reader whose language is not the default asked for a bare URL. Move them
  // to the address that names it, so what they share, bookmark and get indexed
  // on is the page they are reading rather than its English twin. Temporary,
  // for the same reason as the region above: it follows a cookie.
  if (!prefixed && locale !== DEFAULT_LOCALE) {
    const url = req.nextUrl.clone();
    url.pathname = localizePath(rest, locale);
    return perVisitorRedirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PATHNAME_HEADER, pathname);
  // Route handlers under `app/[locale]` read the segment from their own params.
  // This is for the ones that have no params to read: the OG images and the
  // Markdown converter.
  requestHeaders.set(LOCALE_HEADER, locale);

  // A tank addressed by its id goes to its readable slug, and the redirect is
  // made by a route handler rather than by the page: the six tank tabs are
  // `force-static`, and a static page is handed an empty `searchParams`, so the
  // page could not carry the query string over. It matters because these URLs
  // are what the World of Tanks mod links to, campaign tags and all, and a
  // redirect that drops them files every visit it sends as direct traffic.
  //
  // Same move as `?page=N` and `sitemap-3.xml` above: the address a reader uses
  // resolved onto the route that can actually serve it. The rewrite carries the
  // query untouched, and the handler reads the original path off the header
  // below rather than from parameters of its own, so nothing it needs can
  // collide with something the caller sent.
  // Only when there is a query to save. Without one the page's own redirect is
  // already right, and leaving it in charge keeps the rest of its behaviour,
  // notably the 404 it draws for an id no vehicle answers to: a route handler
  // cannot render that page.
  if (req.nextUrl.search && NUMERIC_TANK.test(rest)) {
    const url = req.nextUrl.clone();
    url.pathname = "/api/internal/tank-id";
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  const url = req.nextUrl.clone();
  // Always prefixed, including in the default language. This is the internal
  // address of the route (`app/[locale]/...`), not the public one: the reader's
  // URL is untouched, which is exactly what serves English at `/tanks` while the
  // page still lives under a locale segment. A `?page=` the section has a route
  // for rides into that address as a segment, for the reason above.
  const page = paginatedRoute(rest, req.nextUrl.searchParams);
  const target = page ?? rest;
  url.pathname = target === "/" ? `/${locale}` : `/${locale}${target}`;
  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  // Tell CDNs to cache HTML and markdown separately so an agent hitting
  // `Accept: text/markdown` never receives a cached HTML response.
  response.headers.set("Vary", "Accept");

  // NB: we deliberately do NOT sync the region or the locale cookie here. Both
  // are the user's *chosen* default, written only when they pick one (the region
  // selector and search dialog, the language menu), and a prefixed URL wins
  // locally anyway. Auto-writing them made merely opening a shared `/na/...`
  // link hijack the default region for a year, so a later bare path (`/`,
  // `/clans`) sent the user to the wrong one. A shared `/fr/...` link would do
  // exactly the same to the language.
  return response;
}

export const config = {
  matcher: [
    // Match all paths except Next internals + static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
