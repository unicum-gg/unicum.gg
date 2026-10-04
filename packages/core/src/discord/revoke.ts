import { env } from "@unicum.gg/shared";

const REVOKE_URL = "https://discord.com/api/v10/oauth2/token/revoke";
const TIMEOUT_MS = 10_000;

/**
 * Hand a player's Discord authorization back when they disconnect.
 *
 * The scopes we asked for are `identify` and `guilds.join`, and the second one
 * is the reason this is worth a call rather than just dropping the row: a token
 * that can add somebody to a server should stop existing when they say so, not
 * merely stop being reachable by us.
 *
 * Best-effort, like the Discord calls beside it: the link is removed either
 * way, and the token expires on its own.
 */
export async function revokeDiscordToken(token: string): Promise<boolean> {
  const { DISCORD_APP_ID, DISCORD_CLIENT_SECRET } = env;
  if (!DISCORD_APP_ID || !DISCORD_CLIENT_SECRET) return false;
  const res = await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: DISCORD_APP_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      token,
      token_type_hint: "access_token",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  return Boolean(res?.ok);
}
