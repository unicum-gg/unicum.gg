import { NextResponse, type NextRequest } from "next/server";
import STORAGE from "@/constants/storage";
import { matchesAnyRoute } from "@/lib/route-match";
import {
  DEFAULT_LOCALE,
  getPreferredLocale,
  localizePath,
  splitLocale,
} from "@/lib/translations";
import {
  REGIONAL_PAGES,
  REGIONLESS_HANDLERS,
  REGIONLESS_PAGES,
  ROOT_HANDLERS,
  UNLOCALIZED_PAGES,
} from "@/proxy-routes.generated";
import { isRegion, Region } from "@unicum.gg/wargaming";

const PATHNAME_HEADER = "x-pathname";
const LOCALE_HEADER = "x-locale";

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
 * Send a page to the Markdown converter, keeping the address it was asked at.
 *
 * The slug keeps the locale prefix, so the page the route fetches back is the
 * one in the language that was asked for.
 */
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

  const url = req.nextUrl.clone();
  // Always prefixed, including in the default language. This is the internal
  // address of the route (`app/[locale]/...`), not the public one: the reader's
  // URL is untouched, which is exactly what serves English at `/tanks` while the
  // page still lives under a locale segment.
  url.pathname = rest === "/" ? `/${locale}` : `/${locale}${rest}`;
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
