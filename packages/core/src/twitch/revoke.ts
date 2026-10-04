import { env } from "@unicum.gg/shared";

const REVOKE_URL = "https://id.twitch.tv/oauth2/revoke";
const TIMEOUT_MS = 10_000;

/**
 * Hand a player's Twitch user token back to Twitch when they disconnect.
 *
 * Deleting our row is what stops us using the token, and this is what stops the
 * token existing: it carries `user:write:chat`, so until it is revoked a copy
 * of it could still post in that channel as them, and a player disconnecting is
 * saying exactly that they want that to stop. Best-effort on purpose, Twitch
 * being unreachable must not hold up the disconnect: the row is gone either
 * way, and an unrevoked token expires on its own four hours later.
 */
export async function revokeTwitchToken(accessToken: string): Promise<boolean> {
  if (!env.TWITCH_CLIENT_ID) return false;
  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    token: accessToken,
  });
  const res = await fetch(REVOKE_URL, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  // 400 is Twitch's answer for a token it does not know, which is the state we
  // were asking for.
  return Boolean(res && (res.ok || res.status === 400));
}
