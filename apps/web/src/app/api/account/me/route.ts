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
import {
  isBattlesHidden,
  setBattlesHidden,
} from "@unicum.gg/core/battles/privacy";
import { isRegion } from "@unicum.gg/wargaming";
import { revalidatePlayerProfile } from "@/services/players/revalidate";

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
 * not use it, or one whose position is guessed, is worse than none. The battle
 * list switch beside it is everybody's.
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
      battlesHidden: false,
    });
  }
  // The privacy flags hang off the Wargaming account, so they wait for it, but
  // beside each other and beside the rest rather than one after the next: the
  // settings dialog opens on this answer.
  const wargamingRead = wargamingAccountOf(session.user.id);
  const [connections, supporter, loadoutsHidden, battlesHidden] =
    await Promise.all([
      listAccountConnections(session.user.id),
      isSupporter(session.user.id),
      wargamingRead.then((w) => (w ? isLoadoutHidden(w) : false)),
      wargamingRead.then((w) => (w ? isBattlesHidden(w) : false)),
    ]);
  return NextResponse.json({
    loggedIn: true,
    ...available,
    ...connections,
    supporter,
    loadoutsHidden,
    battlesHidden,
  });
}

/**
 * Change one of this account's privacy switches: `loadoutsHidden`,
 * `battlesHidden`, or both in one body.
 *
 * The same switches as `PATCH /api/game/me`, from the other side: that one is
 * drawn by the mod's own settings window and acts for a game client's secret,
 * this one is drawn by the settings dialog and acts for a signed-in session.
 * Both end at the same setters, so the two can never disagree on what the
 * player asked for, and the gates are repeated rather than shared because each
 * side resolves its account differently.
 *
 * Hiding the loadouts is a supporter's switch. Distinct from unticking "share
 * my loadouts" in the mod, which stops the uploads and deletes what was sent:
 * this one keeps contributing to the population figures and only takes the
 * panel off the player's own page.
 *
 * Hiding the battles is everybody's: it is asked for by players whose team
 * practice would otherwise be readable by whoever they face next, and charging
 * for it would put a price on keeping that quiet. The battles keep arriving;
 * only the profile's Battles tab answers its owner alone.
 */
export async function PATCH(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    loadoutsHidden?: unknown;
    battlesHidden?: unknown;
  } | null;
  const loadoutsHidden = body?.loadoutsHidden;
  const battlesHidden = body?.battlesHidden;
  const valid =
    (loadoutsHidden === undefined || typeof loadoutsHidden === "boolean") &&
    (battlesHidden === undefined || typeof battlesHidden === "boolean") &&
    (loadoutsHidden !== undefined || battlesHidden !== undefined);
  if (!valid) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const [supporter, wargaming] = await Promise.all([
    loadoutsHidden === undefined ? true : isSupporter(session.user.id),
    wargamingAccountOf(session.user.id),
  ]);
  if (!supporter) {
    return NextResponse.json({ error: "not_a_supporter" }, { status: 403 });
  }
  if (!wargaming) {
    // Nothing to hide: both switches are keyed by the Wargaming account, and
    // this session has none bound to it.
    return NextResponse.json(
      { error: "no_wargaming_account" },
      { status: 409 },
    );
  }
  if (typeof loadoutsHidden === "boolean") {
    await setLoadoutHidden(wargaming, session.user.id, loadoutsHidden);
  }
  if (typeof battlesHidden === "boolean") {
    await setBattlesHidden(wargaming, session.user.id, battlesHidden);
    // The account key is `<region>-<account id>`, and the session's user
    // carries the nickname the Wargaming sign-in gave it, which is the
    // profile's. Dropped now rather than when the day-long cache runs out.
    const region = wargaming.split("-")[0];
    if (isRegion(region)) revalidatePlayerProfile(region, session.user.name);
  }
  return NextResponse.json({
    loadoutsHidden: await isLoadoutHidden(wargaming),
    battlesHidden: await isBattlesHidden(wargaming),
  });
}
