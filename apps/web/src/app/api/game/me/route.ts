import { twitchLoginOf, unlinkGameClient } from "@unicum.gg/core/game-link";
import { twitchChatAccess } from "@unicum.gg/core/twitch/chat";
import { gameClientSecret, gameClientUser } from "@/services/game";

export const dynamic = "force-dynamic";

/**
 * What the game mod's link acts for: the account's name, its Twitch channel
 * and whether that chat can be written to. 401 until the link exists, which is what the mod
 * polls on while its sign-in browser is open. Not part of the public API: its
 * only caller is the mod, with the secret the link was made for.
 */
export async function GET(req: Request): Promise<Response> {
  const client = await gameClientUser(req);
  if (!client) {
    return Response.json({ error: "not_linked" }, { status: 401 });
  }
  const [twitch, twitchLogin] = await Promise.all([
    twitchChatAccess(client.userId),
    twitchLoginOf(client.userId),
  ]);
  return Response.json(
    { name: client.name, twitch, twitchLogin },
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
