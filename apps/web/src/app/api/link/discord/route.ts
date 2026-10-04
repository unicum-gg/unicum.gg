import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { env, safePath } from "@unicum.gg/shared";
import { auth } from "@unicum.gg/core/auth";
import { getDiscordUserId } from "@unicum.gg/core/discord/supporter-role";
import { startDiscordLink } from "@/services/discord/link";
import ROUTES from "@/constants/routes";
import { signInRegion } from "@/lib/auth-region";

/**
 * Link a Discord account, for its own sake.
 *
 * Distinct from `/api/connect/discord`, which is the supporter-role claim: that
 * one requires an active subscription and lands on the role sync, so it cannot
 * serve a reader who just suggested a video and would like to hear what became
 * of it. The link itself is worth having on its own, since it is the only thing
 * that lets a moderation verdict reach anybody.
 *
 * Both routes go through the same Better Auth link, so an account linked here is
 * the same single link the role sync reads, and vice versa.
 *
 * `return` is where the reader came from, so they land back on the page they
 * were reading rather than on a settings screen they never asked for. Narrowed
 * to a same-origin relative path, or this would be an open redirect.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestHeaders = await headers();
  const destination = safePath(
    new URL(request.url).searchParams.get("return"),
  );
  const back = () =>
    NextResponse.redirect(new URL(destination, env.NEXT_PUBLIC_APP_URL));

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    // Sign in first, coming back here so the link still happens afterwards. The
    // region is the one they last signed in on: a WG account lives on exactly
    // one, and the portal cannot be guessed from the page they were reading.
    const region = signInRegion(await cookies());
    const resume = `/api/link/discord?return=${encodeURIComponent(destination)}`;
    return NextResponse.redirect(
      new URL(ROUTES.AUTH_SIGN_IN(region, resume), env.NEXT_PUBLIC_APP_URL),
    );
  }

  // Already linked: nothing to do, and nothing to say about it either. The page
  // they return to reads the state itself.
  if (await getDiscordUserId(session.user.id)) return back();

  const started = await startDiscordLink(requestHeaders, destination);
  // A failure here is Discord's or Better Auth's, and the reader has nothing to
  // act on: send them back rather than onto an error screen for a courtesy they
  // did not strictly need.
  if (!started) return back();

  const res = NextResponse.redirect(started.url);
  for (const cookie of started.setCookies) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
