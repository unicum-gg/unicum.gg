import { NextResponse } from "next/server";
import { APP_IDENTITY } from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { discordBoostAuthorizeUrl, discordConfig } from "@/services/discord";

// Starts the boost-notification connect flow: like "Add to Discord" but with the
// `guilds` scope (to list the officer's servers) and post permissions. Carries a
// same-origin `continue` path so the callback returns to the page it started
// from, and a CSRF nonce — both in an HttpOnly cookie the callback validates.
export const dynamic = "force-dynamic";

/** Constrain the return path to a same-origin relative URL (no open redirect).
 * Rejects backslashes too: the WHATWG URL parser treats `\` as `/`, so `/\evil`
 * would otherwise resolve to `https://evil/` when joined to the app origin. */
function safeContinue(p: string | null): string {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) {
    return "/";
  }
  return p;
}

export async function GET(req: Request): Promise<Response> {
  const config = discordConfig();
  const continueUrl = safeContinue(new URL(req.url).searchParams.get("continue"));
  if (!config) {
    return NextResponse.redirect(new URL(continueUrl, APP_IDENTITY.URL));
  }

  const nonce = crypto.randomUUID();
  const res = NextResponse.redirect(
    discordBoostAuthorizeUrl(config.appId, nonce),
  );
  res.cookies.set(
    STORAGE.COOKIES.DISCORD_BOOST_STATE,
    JSON.stringify({ n: nonce, url: continueUrl }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: APP_IDENTITY.URL.startsWith("https://"),
      path: "/api/discord",
      maxAge: 600,
    },
  );
  return res;
}
