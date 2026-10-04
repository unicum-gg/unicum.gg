import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { listAccountConnections } from "@unicum.gg/core/auth/connections";
import { discordLinkEnabled } from "@unicum.gg/core/discord";
import { isTwitchEnabled } from "@unicum.gg/core/twitch";

// Per-session account state; not cacheable.
export const dynamic = "force-dynamic";

/**
 * What the account page reads: which accounts this session has connected, and
 * which ones can be connected at all.
 *
 * Internal rather than part of the public API, like `/api/support/me` beside
 * it: every field is about one session, so there is nothing here an external
 * caller could ask for, and the SDK is generated from the documented endpoints.
 *
 * The `*Available` flags answer a question the connections cannot: a provider
 * whose credentials are not configured has no OAuth to start, so the page must
 * leave its row out rather than offer a button that redirects into an error.
 * Twitch and Discord are each independently optional in `env`.
 */
export async function GET(): Promise<Response> {
  const available = {
    twitchAvailable: isTwitchEnabled(),
    discordAvailable: discordLinkEnabled(),
  };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({
      loggedIn: false,
      ...available,
      wargaming: null,
      twitch: null,
      discord: null,
    });
  }
  const connections = await listAccountConnections(session.user.id);
  return NextResponse.json({
    loggedIn: true,
    ...available,
    ...connections,
  });
}
