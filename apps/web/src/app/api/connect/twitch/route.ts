import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { env } from "@unicum.gg/core/env";
import { isRegion, Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";

// Reads the session + starts the Twitch OAuth link, both per-request.
export const dynamic = "force-dynamic";

/**
 * Resume point that chains Wargaming.net login straight into linking Twitch,
 * reached as the sign-in `callbackURL`. It is a server redirect, not a rendered
 * page: it starts the Twitch OAuth link server-side and 302s straight to Twitch,
 * so a logged-out streamer flows WG login → Twitch with no visible in-between
 * screen (and none of the client round-trips the old page needed: session load
 * + link-social). If somehow reached logged out, it bounces back through WG
 * login and returns here.
 */
export async function GET(): Promise<Response> {
  const requestHeaders = await headers();
  const home = new URL("/", env.NEXT_PUBLIC_APP_URL);

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    const stored = (await cookies()).get(STORAGE.COOKIES.REGION)?.value;
    const region = stored && isRegion(stored) ? stored : Region.EU;
    return NextResponse.redirect(
      new URL(
        ROUTES.AUTH_SIGN_IN(region, "/api/connect/twitch"),
        env.NEXT_PUBLIC_APP_URL,
      ),
    );
  }

  // Kick off the Twitch OAuth link server-side. `asResponse` hands back the full
  // Response so we can forward the OAuth-state cookies Better Auth sets onto our
  // own 302 — they must reach the browser for the Twitch callback to validate.
  let linkResponse: Response;
  try {
    linkResponse = await auth.api.linkSocialAccount({
      body: { provider: "twitch", callbackURL: "/" },
      headers: requestHeaders,
      asResponse: true,
    });
  } catch {
    return NextResponse.redirect(home);
  }

  const { url } = (await linkResponse.json().catch(() => ({}))) as {
    url?: string;
  };
  if (!url) return NextResponse.redirect(home);

  const res = NextResponse.redirect(url);
  const setCookies = (
    linkResponse.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  for (const cookie of setCookies ?? []) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
