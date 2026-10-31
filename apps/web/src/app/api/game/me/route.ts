import {
  twitchLoginOf,
  unlinkGameClient,
  wargamingAccountOf,
} from "@unicum.gg/core/game-link";
import { twitchChatAccess } from "@unicum.gg/core/twitch/chat";
import { isSupporter } from "@unicum.gg/core/subscription";
import {
  isLoadoutHidden,
  setLoadoutHidden,
} from "@unicum.gg/core/tanks/loadouts";
import {
  isBattlesHidden,
  setBattlesHidden,
} from "@unicum.gg/core/battles/privacy";
import { isRegion } from "@unicum.gg/wargaming";
import { gameClientSecret, gameClientUser } from "@/services/game";
import { revalidatePlayerProfile } from "@/services/players/revalidate";

export const dynamic = "force-dynamic";

/**
 * What the game mod's link acts for: the account's name, its Twitch channel
 * and whether that chat can be written to. 401 until the link exists, which is what the mod
 * polls on while its sign-in browser is open. Not part of the public API: its
 * only caller is the mod, with the secret the link was made for.
 *
 * It also carries whether the player supports the site and whether they have
 * hidden their loadouts, because the mod's settings window draws that switch
 * and cannot draw it honestly without both: a switch offered to somebody who
 * may not use it, or one whose position is guessed, is worse than none. And
 * whether they keep their battle list to themselves, the other switch there,
 * which needs no support: it is offered to everybody.
 */
export async function GET(req: Request): Promise<Response> {
  const client = await gameClientUser(req);
  if (!client) {
    return Response.json({ error: "not_linked" }, { status: 401 });
  }
  const [twitch, twitchLogin, supporter, wargaming] = await Promise.all([
    twitchChatAccess(client.userId),
    twitchLoginOf(client.userId),
    isSupporter(client.userId),
    wargamingAccountOf(client.userId),
  ]);
  return Response.json(
    {
      name: client.name,
      twitch,
      twitchLogin,
      supporter,
      loadoutsHidden: wargaming ? await isLoadoutHidden(wargaming) : false,
      battlesHidden: wargaming ? await isBattlesHidden(wargaming) : false,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Change one of this player's privacy switches: `loadoutsHidden`,
 * `battlesHidden`, or both in one body.
 *
 * Hiding the loadouts is a supporter's switch, and the other half of the deal
 * the mod is published on: loadouts are public by default because the
 * aggregates they feed are what pays for a mod with no advertising, and
 * somebody funding it directly has already paid another way. Distinct from
 * unticking "share my loadouts", which stops the uploads and deletes what was
 * sent. This one keeps contributing to the population figures and only takes
 * the panel off the player's own page, so the two are worded as the different
 * things they are.
 *
 * Hiding the battles is everybody's: it is asked for by players whose team
 * practice would otherwise be readable by whoever they face next, and making
 * them pay to keep it quiet would be charging for the harm the site causes.
 * The battles keep arriving all the same; only the profile's Battles tab
 * answers its owner alone. The same switch is on the profile itself.
 */
export async function PATCH(req: Request): Promise<Response> {
  const client = await gameClientUser(req);
  if (!client) {
    return Response.json({ error: "not_linked" }, { status: 401 });
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
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const [supporter, wargaming] = await Promise.all([
    loadoutsHidden === undefined ? true : isSupporter(client.userId),
    wargamingAccountOf(client.userId),
  ]);
  if (!supporter) {
    return Response.json({ error: "not_a_supporter" }, { status: 403 });
  }
  if (!wargaming) {
    // Nothing to hide: both switches are keyed by the Wargaming account, and
    // this link has none bound to it.
    return Response.json({ error: "no_wargaming_account" }, { status: 409 });
  }
  if (typeof loadoutsHidden === "boolean") {
    await setLoadoutHidden(wargaming, client.userId, loadoutsHidden);
  }
  if (typeof battlesHidden === "boolean") {
    await setBattlesHidden(wargaming, client.userId, battlesHidden);
    // The account key is `<region>-<account id>`, and the link's user carries
    // the nickname the Wargaming sign-in gave it, which is the profile's.
    const region = wargaming.split("-")[0];
    if (isRegion(region)) revalidatePlayerProfile(region, client.name);
  }
  return Response.json(
    {
      loadoutsHidden: await isLoadoutHidden(wargaming),
      battlesHidden: await isBattlesHidden(wargaming),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Unlink the game mod making the request: its secret acts for no account any more. */
export async function DELETE(req: Request): Promise<Response> {
  const secret = gameClientSecret(req);
  if (!secret || !(await unlinkGameClient(secret))) {
    return Response.json({ error: "not_linked" }, { status: 401 });
  }
  return new Response(null, { status: 204 });
}
