import { NextResponse, type NextRequest } from "next/server";
import STORAGE from "@/constants/storage";
import { isRegion, Region } from "@/services/wargaming/wot";

const PATHNAME_HEADER = "x-pathname";

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname === "/") {
    const stored = req.cookies.get(STORAGE.COOKIES.REGION)?.value;
    if (stored && isRegion(stored) && stored !== Region.EU) {
      const url = req.nextUrl.clone();
      url.pathname = `/${stored}`;
      return NextResponse.redirect(url);
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PATHNAME_HEADER, pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Match all paths except Next internals + static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
