import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { listAccountConnections } from "@unicum.gg/core/auth/connections";
import { discordLinkEnabled } from "@unicum.gg/core/discord";
import { wargamingAccountOf } from "@unicum.gg/core/game-link";
import { isSupporter } from "@unicum.gg/core/subscription";
import {
  isLoadoutHidden,
  setLoadoutHidden,
} from "@unicum.gg/core/tanks/loadouts";
import { isTwitchEnabled } from "@unicum.gg/core/twitch";

// Per-session account state; not cacheable.
export const dynamic = "force-dynamic";

/**
 * What the settings dialog reads: which accounts this session has connected,
 * which ones can be connected at all, and the settings that belong to the
 * account rather than to the browser.
 *
 * Internal rather than part of the public API, like `/api/support/me` beside
 * it: every field is about one session, so there is nothing here an external
 * caller could ask for, and the SDK is generated from the documented endpoints.
 *
 * The `*Available` flags answer a question the connections cannot: a provider
 * whose credentials are not configured has no OAuth to start, so the page must
 * leave its row out rather than offer a button that redirects into an error.
 * Twitch and Discord are each independently optional in `env`.
 *
 * `supporter` rides along for the same reason `/api/game/me` carries it: the
 * loadout switch is a supporter's, and a switch offered to somebody who may
 * not use it, or one whose position is guessed, is worse than none.
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
      supporter: false,
      loadoutsHidden: false,
    });
  }
  const [connections, supporter, wargaming] = await Promise.all([
    listAccountConnections(session.user.id),
    isSupporter(session.user.id),
    wargamingAccountOf(session.user.id),
  ]);
  return NextResponse.json({
    loggedIn: true,
    ...available,
    ...connections,
    supporter,
    loadoutsHidden: wargaming ? await isLoadoutHidden(wargaming) : false,
  });
}

/**
 * Hide this player's loadouts from their public page, or show them again.
 *
 * The same switch as `PATCH /api/game/me`, from the other side: that one is
 * drawn by the mod's own settings window and acts for a game client's secret,
 * this one is drawn by the settings dialog and acts for a signed-in session.
 * Both end at `setLoadoutHidden`, so the two can never disagree on what the
 * player asked for, and the gates are repeated rather than shared because each
 * side resolves its account differently.
 *
 * Distinct from unticking "share my loadouts" in the mod, which stops the
 * uploads and deletes what was sent. This one keeps contributing to the
 * population figures and only takes the panel off the player's own page.
 */
export async function PATCH(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    loadoutsHidden?: unknown;
  } | null;
  if (typeof body?.loadoutsHidden !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const [supporter, wargaming] = await Promise.all([
    isSupporter(session.user.id),
    wargamingAccountOf(session.user.id),
  ]);
  if (!supporter) {
    return NextResponse.json({ error: "not_a_supporter" }, { status: 403 });
  }
  if (!wargaming) {
    // Nothing to hide: the loadouts are keyed by the Wargaming account, and
    // this session has none bound to it.
    return NextResponse.json(
      { error: "no_wargaming_account" },
      { status: 409 },
    );
  }
  await setLoadoutHidden(wargaming, session.user.id, body.loadoutsHidden);
  return NextResponse.json({ loadoutsHidden: body.loadoutsHidden });
}
