import { NextResponse, type NextRequest } from "next/server";
import STORAGE from "@/constants/storage";
import {
  isRegion,
  Region,
  regionFromPathname,
} from "@/services/wargaming/wot";

const PATHNAME_HEADER = "x-pathname";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const stored = req.cookies.get(STORAGE.COOKIES.REGION)?.value;

  if (
    (pathname === "/" ||
      pathname === "/coverage" ||
      pathname === "/clans" ||
      pathname.startsWith("/clans/") ||
      pathname === "/players" ||
      pathname.startsWith("/players/")) &&
    !pathname.endsWith("/sitemap.xml")
  ) {
    if (stored && isRegion(stored) && stored !== Region.EU) {
      const url = req.nextUrl.clone();
      if (pathname === "/") url.pathname = `/${stored}`;
      else url.pathname = `/${stored}${pathname}`;
      return NextResponse.redirect(url);
    }
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
  if (!isApiRoute && (isMdSuffix || accept.includes("text/markdown"))) {
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

  // Sync the cookie to the URL whenever the URL carries a region. Without
  // this, manually visiting /asia/clans/X with `cookie=eu` leaves them
  // out of sync, and a later link that consults the cookie (the / -> /eu
  // redirect above, or any client-side default) sends the user back to
  // the wrong region.
  const urlRegion = regionFromPathname(pathname);
  if (urlRegion && urlRegion !== stored) {
    response.cookies.set(STORAGE.COOKIES.REGION, urlRegion, {
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except Next internals + static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
