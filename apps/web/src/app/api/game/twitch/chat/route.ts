import {
  sendTwitchChatMessage,
  TWITCH_CHAT_MAX_LENGTH,
  TwitchChatSendStatus,
} from "@unicum.gg/core/twitch/chat";
import { gameClientUser } from "@/services/game";

export const dynamic = "force-dynamic";

const STATUS_CODES: Record<TwitchChatSendStatus, number> = {
  [TwitchChatSendStatus.Sent]: 200,
  [TwitchChatSendStatus.Dropped]: 200,
  [TwitchChatSendStatus.NotLinked]: 409,
  [TwitchChatSendStatus.MissingScope]: 403,
  [TwitchChatSendStatus.Failed]: 502,
};

/**
 * Send a message to the linked account's own Twitch chat, for the game mod
 * (`{ "message": "..." }`, bearer secret). Answers `{ status, reason? }` with
 * a `TwitchChatSendStatus`. Not part of the public API, like `/api/game/me`.
 */
export async function POST(req: Request): Promise<Response> {
  const client = await gameClientUser(req);
  if (!client) {
    return Response.json({ error: "not_linked" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > TWITCH_CHAT_MAX_LENGTH) {
    return Response.json({ error: "invalid_message" }, { status: 400 });
  }
  const result = await sendTwitchChatMessage(client.userId, message);
  return Response.json(result, { status: STATUS_CODES[result.status] });
}
