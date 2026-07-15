import { env } from "@unicum.gg/shared";

/**
 * Minimal Twitch Helix client for the "top players streaming now" feature. Uses
 * an app access token (client-credentials grant, which requires a Confidential
 * client) to poll live status of linked channels. No user context: streams are
 * public data. Kept lean (a few calls per minute) so no rate limiter is needed.
 *
 * The whole feature is gated on the two env vars: absent → `isTwitchEnabled()`
 * is false and the readers no-op, so the app and worker boot fine without them.
 */
const HELIX = "https://api.twitch.tv/helix";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

export function isTwitchEnabled(): boolean {
  return Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
}

/** A currently-live Twitch stream (camelCased subset of the Helix payload). */
export type TwitchStream = {
  userId: string;
  userLogin: string;
  userName: string;
  gameId: string;
  gameName: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  /** Stream language (ISO 639-1, e.g. "en"). */
  language: string;
  /** URL template with `{width}`/`{height}` placeholders to fill client-side. */
  thumbnailUrl: string;
};

type RawStream = {
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
};

function mapStream(s: RawStream): TwitchStream {
  return {
    userId: s.user_id,
    userLogin: s.user_login.toLowerCase(),
    userName: s.user_name,
    gameId: s.game_id,
    gameName: s.game_name,
    title: s.title,
    viewerCount: s.viewer_count,
    startedAt: s.started_at,
    language: s.language,
    thumbnailUrl: s.thumbnail_url,
  };
}

// Per-process app-token cache. Twitch allows several valid app tokens at once,
// so each instance holding its own is fine (no need to share via Redis).
let tokenCache: { token: string; expiresAt: number } | null = null;

async function appToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;
  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID as string,
    client_secret: env.TWITCH_CLIENT_SECRET as string,
    grant_type: "client_credentials",
  });
  const res = await fetch(TOKEN_URL, { method: "POST", body });
  if (!res.ok) throw new Error(`Twitch token HTTP ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

async function helix<T>(
  path: string,
  params: URLSearchParams,
  retryOn401 = true,
): Promise<T> {
  const token = await appToken();
  const res = await fetch(`${HELIX}${path}?${params.toString()}`, {
    headers: {
      "Client-Id": env.TWITCH_CLIENT_ID as string,
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401 && retryOn401) {
    tokenCache = null;
    return helix<T>(path, params, false);
  }
  if (!res.ok) throw new Error(`Twitch Helix ${path} HTTP ${res.status}`);
  return (await res.json()) as T;
}

// The WoT game id is stable but resolved once rather than hard-coded, so a
// rename on Twitch's side can't silently break the category filter.
let wotGameIdCache: string | null = null;

export async function worldOfTanksGameId(): Promise<string | null> {
  if (!isTwitchEnabled()) return null;
  if (wotGameIdCache) return wotGameIdCache;
  const params = new URLSearchParams();
  params.append("name", "World of Tanks");
  const json = await helix<{ data: { id: string }[] }>("/games", params);
  wotGameIdCache = json.data[0]?.id ?? null;
  return wotGameIdCache;
}

/**
 * Live streams for the given Twitch logins (only currently-live channels are
 * returned by Helix). Chunks to Helix's 100-login limit. Not filtered by game.
 */
export async function getStreamsByLogin(
  logins: string[],
): Promise<TwitchStream[]> {
  if (!isTwitchEnabled() || logins.length === 0) return [];
  const out: TwitchStream[] = [];
  for (let i = 0; i < logins.length; i += 100) {
    const chunk = logins.slice(i, i + 100);
    const params = new URLSearchParams();
    for (const login of chunk) params.append("user_login", login);
    const json = await helix<{ data: RawStream[] }>("/streams", params);
    out.push(...json.data.map(mapStream));
  }
  return out;
}

/** A Twitch user (channel), resolved from its numeric id. */
export type TwitchUser = { id: string; login: string; displayName: string };

/**
 * Resolve Twitch channels by their numeric user id (`/helix/users`). Used after
 * a self-service OAuth link to turn the `sub` Better Auth stores into the login
 * we need for the embed and live polling.
 */
export async function getTwitchUsersById(ids: string[]): Promise<TwitchUser[]> {
  if (!isTwitchEnabled() || ids.length === 0) return [];
  const params = new URLSearchParams();
  for (const id of ids.slice(0, 100)) params.append("id", id);
  const json = await helix<{
    data: { id: string; login: string; display_name: string }[];
  }>("/users", params);
  return json.data.map((u) => ({
    id: u.id,
    login: u.login,
    displayName: u.display_name,
  }));
}

/** Like {@link getStreamsByLogin} but only streams live in the WoT category. */
export async function getWotStreamsByLogin(
  logins: string[],
): Promise<TwitchStream[]> {
  const [streams, wotId] = await Promise.all([
    getStreamsByLogin(logins),
    worldOfTanksGameId(),
  ]);
  if (!wotId) return [];
  return streams.filter((s) => s.gameId === wotId);
}
