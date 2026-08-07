import { NextResponse, type NextRequest } from "next/server";
import STORAGE from "@/constants/storage";
import { matchesAnyRoute } from "@/lib/route-match";
import {
  REGIONAL_PAGES,
  REGIONLESS_HANDLERS,
  REGIONLESS_PAGES,
} from "@/proxy-routes.generated";
import { isRegion, Region } from "@unicum.gg/wargaming";

const PATHNAME_HEADER = "x-pathname";

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

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const stored = req.cookies.get(STORAGE.COOKIES.REGION)?.value;
  const region = stored && isRegion(stored) ? stored : Region.EU;

  const kind = regionlessKind(pathname);
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
    url.pathname = pathname === "/" ? `/${region}` : `/${region}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Serve a Markdown rendering of any page through two triggers: a `.md`
  // suffix on the URL (shareable, indexable) or an `Accept: text/markdown`
  // header (for agents and LLMs). Both rewrite to the `/api/md/[...slug]`
  // route, which re-fetches the page HTML and converts `#page-content`.
  // Runs after the region redirect so `.md` requests are region-normalized
  // first. The fetch the route makes carries `Accept: text/html`, so it
  // never re-enters this branch.
  const accept = req.headers.get("accept") || "";
  const isMdSuffix = pathname.endsWith(".md");
  const isApiRoute = pathname.startsWith("/api/");
  const isWellKnown = pathname.startsWith("/.well-known/");
  // Files already served as plain text (`/llms.txt`, `/robots.txt`,
  // `/sitemap.xml`) are not pages, so there is no `#page-content` to convert.
  // Without this, an agent asking for `text/markdown` (exactly the kind of
  // client that fetches `/llms.txt`) would be rewritten into the converter and
  // get a 404 instead of the file.
  const isFile = /\.[^/.]+$/.test(pathname) && !isMdSuffix;
  if (
    !isApiRoute &&
    !isWellKnown &&
    !isFile &&
    (isMdSuffix || accept.includes("text/markdown"))
  ) {
    const clean = isMdSuffix ? pathname.slice(0, -".md".length) : pathname;
    const slug =
      clean === "/" || clean === "" ? "index" : clean.replace(/^\//, "");
    const url = req.nextUrl.clone();
    url.pathname = `/api/md/${slug}`;
    return NextResponse.rewrite(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PATHNAME_HEADER, pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Tell CDNs to cache HTML and markdown separately so an agent hitting
  // `Accept: text/markdown` never receives a cached HTML response.
  response.headers.set("Vary", "Accept");

  // NB: we deliberately do NOT sync the region cookie to the URL here. The
  // cookie is the user's *chosen* default (written only by the region selector
  // / search dialog), and a regional URL wins locally via `useRegion` anyway.
  // Auto-writing it made merely opening a shared `/na/...` link hijack the
  // default region for a year, so a later bare path (`/`, `/clans`) sent the
  // user to the wrong region.
  return response;
}

export const config = {
  matcher: [
    // Match all paths except Next internals + static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
