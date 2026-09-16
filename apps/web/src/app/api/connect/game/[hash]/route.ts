import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import {
  GAME_TOKEN_HASH,
  GameLinkResult,
  linkGameClient,
} from "@unicum.gg/core/game-link";
import {
  TWITCH_CHAT_SCOPE,
  TwitchChatAccess,
  twitchChatAccess,
} from "@unicum.gg/core/twitch/chat";
import { env } from "@unicum.gg/shared";
import { isRegion, Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import { gameSignInResponse } from "@/services/game/sign-in";

// Reads the session + may start the Twitch OAuth link, both per-request.
export const dynamic = "force-dynamic";

// A link only completes on a login made moments ago. The game mod opens this
// route in the player's browser and the sign-in below runs first, so its
// session is always fresh. A link someone else crafted and got a logged-in
// reader to open finds an older session, and has to go back through
// Wargaming's own confirmation screen first.
const FRESH_LOGIN_MS = 10 * 60_000;

/**
 * Resume point that links the World of Tanks mod to the signed-in account, then
 * chains into linking Twitch with the chat scope when that is still missing.
 * The path carries the SHA-256 of a secret only the mod holds (see
 * `@unicum.gg/core/game-link`); the mod polls `/api/game/me` with the secret to
 * learn when this has happened.
 *
 * Without a fresh session it signs in first (`services/game/sign-in`), with the
 * game's Wargaming web token from the URL fragment when there is one, so the
 * player types nothing. `?region=` names the Wargaming portal: the mod knows
 * which server the player is on. `?twitch=0` links the account alone, for the
 * mod's Account section, and never goes on to Twitch.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const home = new URL("/", env.NEXT_PUBLIC_APP_URL);
  const { hash } = await params;
  if (!GAME_TOKEN_HASH.test(hash)) return NextResponse.redirect(home);
  const query = new URL(req.url).searchParams;
  const withTwitch = query.get("twitch") !== "0";

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const fresh =
    session &&
    Date.now() - new Date(session.session.createdAt).getTime() <
      FRESH_LOGIN_MS;
  if (!session?.user || !fresh) {
    const asked = query.get("region") ?? "";
    const region = isRegion(asked) ? asked : Region.EU;
    const callbackURL = `/api/connect/game/${hash}${withTwitch ? "" : "?twitch=0"}`;
    return (
      (await gameSignInResponse(requestHeaders, region, callbackURL)) ??
      NextResponse.redirect(
        new URL(ROUTES.AUTH_SIGN_IN(region, callbackURL), env.NEXT_PUBLIC_APP_URL),
      )
    );
  }

  const linked = await linkGameClient(hash, session.user.id);
  if (linked !== GameLinkResult.Linked) return NextResponse.redirect(home);

  if (
    !withTwitch ||
    (await twitchChatAccess(session.user.id)) === TwitchChatAccess.Ready
  ) {
    return NextResponse.redirect(home);
  }

  // Link Twitch, or link it again to grant the chat scope: Better Auth updates
  // the existing account row with the new token and scopes. Same cookie
  // forwarding as `/api/connect/twitch`.
  let linkResponse: Response;
  try {
    linkResponse = await auth.api.linkSocialAccount({
      body: { provider: "twitch", callbackURL: "/", scopes: [TWITCH_CHAT_SCOPE] },
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
