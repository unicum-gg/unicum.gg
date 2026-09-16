import { and, eq } from "drizzle-orm";
import { auth } from "@unicum.gg/core/auth";
import { db } from "@unicum.gg/core/db";
import { account, env } from "@unicum.gg/shared";

/**
 * Sending a message to the player's own Twitch chat, as the player, for the game
 * mod. The Twitch account is the one linked through Better Auth; the user token
 * it holds is refreshed server-side, since refreshing needs the client secret.
 */

/** The scope Helix's Send Chat Message needs on a user token. */
export const TWITCH_CHAT_SCOPE = "user:write:chat";

/** Helix refuses longer messages. */
export const TWITCH_CHAT_MAX_LENGTH = 500;

const HELIX_CHAT = "https://api.twitch.tv/helix/chat/messages";
const TIMEOUT_MS = 10_000;

/** Whether this user's linked Twitch account can write to its chat. */
export enum TwitchChatAccess {
  Ready = "ready",
  NotLinked = "not_linked",
  MissingScope = "missing_scope",
}

/** How sending a message ended. */
export enum TwitchChatSendStatus {
  Sent = "sent",
  /** Twitch took the request but did not post the message (AutoMod, etc.). */
  Dropped = "dropped",
  NotLinked = "not_linked",
  MissingScope = "missing_scope",
  Failed = "failed",
}

export type TwitchChatSendResult = {
  status: TwitchChatSendStatus;
  /** Twitch's reason when the message was dropped. */
  reason?: string;
};

async function twitchAccountOf(userId: string) {
  const [row] = await db
    .select({ twitchUserId: account.accountId, scope: account.scope })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "twitch")))
    .limit(1);
  return row ?? null;
}

function grants(scope: string | null): boolean {
  // Better Auth stores the granted scopes comma-joined.
  return (scope ?? "").split(/[,\s]+/).includes(TWITCH_CHAT_SCOPE);
}

export async function twitchChatAccess(
  userId: string,
): Promise<TwitchChatAccess> {
  const row = await twitchAccountOf(userId);
  if (!row) return TwitchChatAccess.NotLinked;
  return grants(row.scope)
    ? TwitchChatAccess.Ready
    : TwitchChatAccess.MissingScope;
}

/** Post `message` in the chat of the user's own linked Twitch channel. */
export async function sendTwitchChatMessage(
  userId: string,
  message: string,
): Promise<TwitchChatSendResult> {
  const row = await twitchAccountOf(userId);
  if (!row) return { status: TwitchChatSendStatus.NotLinked };
  if (!grants(row.scope)) return { status: TwitchChatSendStatus.MissingScope };

  let accessToken: string;
  try {
    ({ accessToken } = await auth.api.getAccessToken({
      body: { providerId: "twitch", userId },
    }));
  } catch (err) {
    console.error("[twitch-chat] could not get the user token", err);
    return { status: TwitchChatSendStatus.Failed };
  }

  const res = await fetch(HELIX_CHAT, {
    method: "POST",
    headers: {
      "Client-Id": env.TWITCH_CLIENT_ID as string,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    // The player writes in their own channel, so it is both the room and the
    // sender.
    body: JSON.stringify({
      broadcaster_id: row.twitchUserId,
      sender_id: row.twitchUserId,
      message,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!res) return { status: TwitchChatSendStatus.Failed };
  // A token revoked on Twitch's side, or one whose scope was withdrawn.
  if (res.status === 401) return { status: TwitchChatSendStatus.MissingScope };
  if (!res.ok) {
    console.error(`[twitch-chat] Helix answered HTTP ${res.status}`);
    return { status: TwitchChatSendStatus.Failed };
  }
  const json = (await res.json()) as {
    data?: { is_sent: boolean; drop_reason?: { message?: string } | null }[];
  };
  const sent = json.data?.[0];
  if (sent?.is_sent) return { status: TwitchChatSendStatus.Sent };
  return {
    status: TwitchChatSendStatus.Dropped,
    reason: sent?.drop_reason?.message,
  };
}
