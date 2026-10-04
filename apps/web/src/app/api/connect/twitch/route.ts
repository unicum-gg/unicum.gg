import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { env, safePath } from "@unicum.gg/shared";
import ROUTES from "@/constants/routes";
import { signInRegion } from "@/lib/auth-region";

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
 *
 * `return` is where Twitch sends them once linked, defaulting to the home page
 * the streamers rail that offers this lives on. The connections dialog needs
 * it: it has no address of its own, so a reader who connected Twitch from it
 * has nowhere to come back to but the page they were standing on, which also
 * carries the flag that reopens it. Narrowed to a same-origin relative path,
 * like `/api/link/discord`, or this would be an open redirect.
 */
export async function GET(request: Request): Promise<Response> {
  const requestHeaders = await headers();
  const destination = safePath(new URL(request.url).searchParams.get("return"));
  // Where a failure lands, which is wherever they came from: a reader has
  // nothing to act on when Twitch or Better Auth refuses the link.
  const back = new URL(destination, env.NEXT_PUBLIC_APP_URL);

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    const region = signInRegion(await cookies());
    const resume = `/api/connect/twitch?return=${encodeURIComponent(destination)}`;
    return NextResponse.redirect(
      new URL(ROUTES.AUTH_SIGN_IN(region, resume), env.NEXT_PUBLIC_APP_URL),
    );
  }

  // Kick off the Twitch OAuth link server-side. `asResponse` hands back the full
  // Response so we can forward the OAuth-state cookies Better Auth sets onto our
  // own 302 — they must reach the browser for the Twitch callback to validate.
  let linkResponse: Response;
  try {
    linkResponse = await auth.api.linkSocialAccount({
      body: { provider: "twitch", callbackURL: destination },
      headers: requestHeaders,
      asResponse: true,
    });
  } catch {
    return NextResponse.redirect(back);
  }

  const { url } = (await linkResponse.json().catch(() => ({}))) as {
    url?: string;
  };
  if (!url) return NextResponse.redirect(back);

  const res = NextResponse.redirect(url);
  const setCookies = (
    linkResponse.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  for (const cookie of setCookies ?? []) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
