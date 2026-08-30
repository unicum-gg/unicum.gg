import { chunkArray } from "@unicum.gg/wargaming";
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
/** Helix caps every batched lookup (`/streams`, `/users`) at this many values. */
const HELIX_BATCH = 100;

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
// In-flight mint, so concurrent callers share one request instead of racing.
// `getWotStreamsByLogin` already fans out, and the reconcile pass adds more, so
// an expired token would otherwise have every branch POST to the token endpoint
// at once and clobber each other's result on the way back.
let tokenInFlight: Promise<string> | null = null;

async function appToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;
  if (tokenInFlight) return tokenInFlight;
  tokenInFlight = (async () => {
    const body = new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID as string,
      client_secret: env.TWITCH_CLIENT_SECRET as string,
      grant_type: "client_credentials",
    });
    const res = await fetch(TOKEN_URL, { method: "POST", body });
    if (!res.ok) throw new Error(`Twitch token HTTP ${res.status}`);
    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    tokenCache = {
      token: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  })();
  try {
    return await tokenInFlight;
  } finally {
    tokenInFlight = null;
  }
}

/** A non-2xx Helix response, carrying the status so callers can branch on it. */
export class TwitchHelixError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`Twitch Helix ${path} HTTP ${status}`);
    this.name = "TwitchHelixError";
  }
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
  if (!res.ok) throw new TwitchHelixError(res.status, path);
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
  for (const chunk of chunkArray(logins, HELIX_BATCH)) {
    const params = new URLSearchParams();
    for (const login of chunk) params.append("user_login", login);
    const json = await helix<{ data: RawStream[] }>("/streams", params);
    out.push(...json.data.map(mapStream));
  }
  return out;
}

/** A Twitch user (channel), resolved from its numeric id. */
export type TwitchUser = { id: string; login: string; displayName: string };

/** Which field a `/helix/users` lookup keys on. Doubles as the query param. */
export enum UserLookup {
  Id = "id",
  Login = "login",
}

/** What one `/users` batch produced, and which values Helix refused outright. */
type UserBatch = { users: TwitchUser[]; rejected: string[] };

/**
 * `/helix/users` by either lookup key, chunked to Helix's per-request limit
 * rather than truncated: the reconcile pass sends every tracked channel at once,
 * and a silently dropped tail would read as "channel gone".
 */
async function getTwitchUsers(
  key: UserLookup,
  values: string[],
): Promise<TwitchUser[]> {
  if (!isTwitchEnabled() || values.length === 0) return [];
  const out: TwitchUser[] = [];
  for (const chunk of chunkArray(values, HELIX_BATCH)) {
    const batch = await fetchUserBatch(key, chunk);
    for (const value of batch.rejected) {
      console.warn(`[twitch] Helix rejected ${key} ${value}`);
    }
    out.push(...batch.users);
  }
  return out;
}

/**
 * One `/users` request, bisecting on a rejected identifier.
 *
 * Helix answers 400 "Bad Identifiers" for the WHOLE request as soon as one
 * value is malformed, so a single bad row would otherwise take every other
 * channel down with it. Splitting on that status isolates the offender and lets
 * the rest through, the same way the WG transport bisects a batch on
 * INVALID_ACCOUNT_ID. An unknown but well-formed identifier is not an error:
 * Helix returns 200 with an empty `data`, and the caller reads the absence.
 *
 * Two things keep the split honest. It recurses sequentially, because `helix()`
 * sits behind no rate limiter and a parallel fan-out could put ~50 requests in
 * flight to isolate one bad value. And a half that fails ENTIRELY rethrows
 * instead of reporting every value as rejected: a 400 that survives being split
 * down to single values is a broken request, not broken data, and degrading it
 * to an empty result would tell the caller its whole roster had vanished.
 */
async function fetchUserBatch(
  key: UserLookup,
  values: string[],
): Promise<UserBatch> {
  const params = new URLSearchParams();
  for (const value of values) params.append(key, value);
  try {
    const json = await helix<{
      data: { id: string; login: string; display_name: string }[];
    }>("/users", params);
    return {
      users: json.data.map((u) => ({
        id: u.id,
        login: u.login.toLowerCase(),
        displayName: u.display_name,
      })),
      rejected: [],
    };
  } catch (err) {
    if (!(err instanceof TwitchHelixError) || err.status !== 400) throw err;
    if (values.length === 1) return { users: [], rejected: [values[0]] };
    const mid = Math.ceil(values.length / 2);
    const left = await fetchUserBatch(key, values.slice(0, mid));
    const right = await fetchUserBatch(key, values.slice(mid));
    const rejected = [...left.rejected, ...right.rejected];
    if (rejected.length === values.length) throw err;
    return { users: [...left.users, ...right.users], rejected };
  }
}

/**
 * Resolve Twitch channels by their numeric user id (`/helix/users`). Used after
 * a self-service OAuth link to turn the `sub` Better Auth stores into the login
 * we need for the embed and live polling, and by the reconcile pass to detect
 * a channel that has been renamed under a stored id.
 */
export function getTwitchUsersById(ids: string[]): Promise<TwitchUser[]> {
  return getTwitchUsers(UserLookup.Id, ids);
}

/**
 * Resolve Twitch channels by their current login. Only used to backfill the
 * stable numeric id of a curated seed, which is entered as a channel name.
 * A login that resolves to nothing here is either misspelled or already
 * renamed, and there is no id stored to recover it from.
 */
export function getTwitchUsersByLogin(logins: string[]): Promise<TwitchUser[]> {
  return getTwitchUsers(UserLookup.Login, logins);
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
