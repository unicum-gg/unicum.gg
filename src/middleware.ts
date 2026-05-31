import { NextResponse, type NextRequest } from "next/server";
import STORAGE from "@/constants/storage";
import { isRegion, Region } from "@/services/wargaming/wot";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname !== "/") return NextResponse.next();

  const stored = req.cookies.get(STORAGE.COOKIES.REGION)?.value;
  if (!stored || !isRegion(stored) || stored === Region.EU) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${stored}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/",
};
