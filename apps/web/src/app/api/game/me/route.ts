import { unlinkGameClient } from "@unicum.gg/core/game-link";
import { twitchChatAccess } from "@unicum.gg/core/twitch/chat";
import { gameClientSecret, gameClientUser } from "@/services/game";

export const dynamic = "force-dynamic";

/**
 * What the game mod's link acts for: the account's name and whether its Twitch
 * chat can be written to. 401 until the link exists, which is what the mod
 * polls on while its sign-in browser is open. Not part of the public API: its
 * only caller is the mod, with the secret the link was made for.
 */
export async function GET(req: Request): Promise<Response> {
  const client = await gameClientUser(req);
  if (!client) {
    return Response.json({ error: "not_linked" }, { status: 401 });
  }
  return Response.json(
    { name: client.name, twitch: await twitchChatAccess(client.userId) },
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
