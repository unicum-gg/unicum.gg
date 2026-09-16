import type { OAuth2Tokens } from "better-auth/oauth2";
import { env } from "@unicum.gg/shared";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TIMEOUT_MS = 10_000;

/**
 * Refresh a linked Twitch account's user token, for Better Auth's `twitch`
 * provider (`refreshAccessToken`).
 *
 * Better Auth's own refresh reads the granted scopes as `data.scope.split(" ")`,
 * the OAuth spec's space-separated string. Twitch answers with an ARRAY there,
 * so the built-in refresh throws on every call, and `getAccessToken` reports it
 * as FAILED_TO_GET_ACCESS_TOKEN: nothing that needs a user token (sending a chat
 * message for the player) would outlive the first token's four hours.
 */
export async function refreshTwitchToken(
  refreshToken: string,
): Promise<OAuth2Tokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.TWITCH_CLIENT_ID as string,
    client_secret: env.TWITCH_CLIENT_SECRET as string,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Twitch token refresh HTTP ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    scope?: string[] | string;
  };
  const scopes = Array.isArray(data.scope)
    ? data.scope
    : data.scope?.split(" ");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type,
    scopes,
    accessTokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
  };
}
