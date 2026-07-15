import { NextResponse } from "next/server";
import { APP_IDENTITY } from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { discordAuthorizeUrl, discordConfig } from "@/services/discord";

// Starts the "Add to Discord" flow: mint a CSRF nonce, stash it in a signed-free
// HttpOnly cookie (unforgeable by another origin), and 302 to Discord's consent
// screen. The callback rejects unless the returned `state` matches the cookie.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const config = discordConfig();
  // Not configured → nothing to install; send them to the community server.
  if (!config) {
    return NextResponse.redirect(new URL("/bot", APP_IDENTITY.URL));
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(discordAuthorizeUrl(config.appId, state));
  res.cookies.set(STORAGE.COOKIES.DISCORD_OAUTH_STATE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: APP_IDENTITY.URL.startsWith("https://"),
    path: "/api/discord",
    maxAge: 600,
  });
  return res;
}
