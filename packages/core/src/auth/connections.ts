import { and, eq } from "drizzle-orm";
import {
  AuthProvider,
  account as accountTable,
  wgIdentityFromAccountKey,
  type ConnectableProvider,
  type WgIdentity,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { auth } from "@unicum.gg/core/auth";
import { getDiscordAccount } from "@unicum.gg/core/discord";
import { revokeDiscordToken } from "@unicum.gg/core/discord/revoke";
import {
  getDiscordUserId,
  releaseSupporterRole,
} from "@unicum.gg/core/discord/supporter-role";
import { twitchLoginOf, wargamingAccountOf } from "@unicum.gg/core/game-link";
import { getTwitchUsersById, isTwitchEnabled } from "@unicum.gg/core/twitch";
import { revokeTwitchToken } from "@unicum.gg/core/twitch/revoke";
import { removeStreamer } from "@unicum.gg/core/twitch/streamers";

/**
 * The accounts connected to one unicum.gg account, and taking one off again.
 *
 * Connecting is spread across the routes that each have a reason to ask for it
 * (`/api/connect/twitch` for the live rail, `/api/connect/discord` for the
 * supporter role, `/api/link/discord` so a moderation verdict can reach
 * somebody). Disconnecting has no such reason to be anywhere in particular, and
 * the player is the only one who can ask for it, so it lives here once and the
 * account page is the single place it is offered.
 */

/** What a connected Twitch account looks like to the account page. */
export type TwitchConnection = {
  twitchUserId: string;
  /** The channel name, which is what a reader recognises. Null if Twitch could
   * not be reached to resolve it and no streamer row carries it. */
  login: string | null;
  connectedAt: Date;
};

/** What a connected Discord account looks like to the account page. */
export type DiscordConnection = {
  discordUserId: string;
  /** The handle. Null when the bot could not look it up. */
  username: string | null;
  /** The display name, when they set one. */
  globalName: string | null;
  connectedAt: Date;
};

export type AccountConnections = {
  /** The identity itself, which is read-only: it is what the account IS. */
  wargaming: (WgIdentity & { connectedAt: Date }) | null;
  twitch: TwitchConnection | null;
  discord: DiscordConnection | null;
};

type AccountRow = { accountId: string; createdAt: Date };

/** Every provider row of one user, keyed by provider, in one query. */
async function accountRows(
  userId: string,
): Promise<Partial<Record<AuthProvider, AccountRow>>> {
  const rows = await db
    .select({
      providerId: accountTable.providerId,
      accountId: accountTable.accountId,
      createdAt: accountTable.createdAt,
    })
    .from(accountTable)
    .where(eq(accountTable.userId, userId));
  const byProvider: Partial<Record<AuthProvider, AccountRow>> = {};
  for (const row of rows) {
    // A provider we do not offer is nothing to this page, and keying the map on
    // the enum is what keeps it from having to be listed twice.
    if (!Object.values(AuthProvider).includes(row.providerId as AuthProvider)) {
      continue;
    }
    byProvider[row.providerId as AuthProvider] = {
      accountId: row.accountId,
      createdAt: row.createdAt,
    };
  }
  return byProvider;
}

/**
 * The channel name behind a linked Twitch id.
 *
 * The `account` row holds the id and never the login, because a streamer can
 * rename and a stored copy would start naming somebody else (which is what
 * `streamer-reconcile-cron` exists for). The streamers row that the link itself
 * wrote carries the current one, so that is read first and Twitch is only asked
 * when it is somehow absent.
 */
async function twitchLogin(
  userId: string,
  twitchUserId: string,
): Promise<string | null> {
  const stored = await twitchLoginOf(userId);
  if (stored) return stored;
  if (!isTwitchEnabled()) return null;
  const [user] = await getTwitchUsersById([twitchUserId]).catch(() => []);
  return user?.login ?? null;
}

/**
 * Everything the account page shows, for one user.
 *
 * The two external lookups (the Twitch login, the Discord handle) are the one
 * part that can fail, and each fails to a null rather than to an error: a page
 * that cannot name the connected account must still be able to offer the button
 * that removes it, which is the whole reason a reader is on it.
 */
export async function listAccountConnections(
  userId: string,
): Promise<AccountConnections> {
  const rows = await accountRows(userId);
  const wg = rows[AuthProvider.Wargaming];
  const twitchRow = rows[AuthProvider.Twitch];
  const discordRow = rows[AuthProvider.Discord];

  const [twitch, discord] = await Promise.all([
    twitchRow
      ? twitchLogin(userId, twitchRow.accountId).then((login) => ({
          twitchUserId: twitchRow.accountId,
          login,
          connectedAt: twitchRow.createdAt,
        }))
      : null,
    discordRow
      ? getDiscordAccount(discordRow.accountId)
          .catch(() => null)
          .then((user) => ({
            discordUserId: discordRow.accountId,
            username: user?.username ?? null,
            globalName: user?.globalName ?? null,
            connectedAt: discordRow.createdAt,
          }))
      : null,
  ]);

  const identity = wgIdentityFromAccountKey(wg?.accountId);
  return {
    wargaming:
      identity && wg ? { ...identity, connectedAt: wg.createdAt } : null,
    twitch,
    discord,
  };
}

/** How a disconnect ended. */
export enum DisconnectResult {
  Disconnected = "disconnected",
  /** There was nothing to disconnect, which a reader reaching the same button
   * twice gets, so it is an outcome rather than a failure. */
  NotConnected = "not_connected",
}

/**
 * Hand a player's Twitch authorization back and stop listing their channel.
 *
 * The streamers row is the point: the link is what put them in the live rail
 * and on the player badges, verified, so leaving it behind would keep
 * advertising a channel whose owner has just withdrawn the one proof we had
 * that it is theirs.
 */
async function disconnectTwitch(userId: string): Promise<DisconnectResult> {
  const [row] = await db
    .select({ id: accountTable.id, accountId: accountTable.accountId })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, userId),
        eq(accountTable.providerId, AuthProvider.Twitch),
      ),
    )
    .limit(1);
  if (!row) return DisconnectResult.NotConnected;

  // Before the row goes: `getAccessToken` is what can read the stored token at
  // all (it is encrypted at rest, and it refreshes an expired one, which is
  // what makes the revoke below reach the live authorization rather than a
  // four-hour-old token Twitch has already forgotten).
  const accessToken = await auth.api
    .getAccessToken({
      body: { providerId: AuthProvider.Twitch, userId },
    })
    .then((res) => res.accessToken)
    .catch(() => null);

  const wargaming = wgIdentityFromAccountKey(await wargamingAccountOf(userId));

  await db.delete(accountTable).where(eq(accountTable.id, row.id));
  if (wargaming) {
    await removeStreamer(wargaming.region, wargaming.accountId);
  }
  if (accessToken) await revokeTwitchToken(accessToken);
  return DisconnectResult.Disconnected;
}

/**
 * Hand a player's Discord authorization back and give the supporter role up.
 *
 * The role has to go first, while the link is still readable: once the row is
 * gone `reconcileSupporterRole` answers "never linked, nothing to reconcile"
 * for this user, so a role left granted here would never be revoked by
 * anything, on an account we no longer hold an id for.
 */
async function disconnectDiscord(userId: string): Promise<DisconnectResult> {
  const discordUserId = await getDiscordUserId(userId);
  if (!discordUserId) return DisconnectResult.NotConnected;

  await releaseSupporterRole(userId, discordUserId);
  const accessToken = await auth.api
    .getAccessToken({
      body: { providerId: AuthProvider.Discord, userId },
    })
    .then((res) => res.accessToken)
    .catch(() => null);

  await db
    .delete(accountTable)
    .where(
      and(
        eq(accountTable.userId, userId),
        eq(accountTable.providerId, AuthProvider.Discord),
      ),
    );
  if (accessToken) await revokeDiscordToken(accessToken);
  return DisconnectResult.Disconnected;
}

/**
 * Disconnect one of the accounts a player connected themselves.
 *
 * Deliberately not Better Auth's own `unlinkAccount`, for two reasons that both
 * bite in production. It sits behind `freshSessionMiddleware`, and `freshAge`
 * defaults to 24 hours measured on the session's `createdAt`, which the rolling
 * refresh never moves: every player signed in longer than a day would press
 * this and be answered 403 by an endpoint that looks like it worked. And it
 * deletes the row and nothing else, where the row is the smallest part of what
 * a connection here actually is.
 */
export async function disconnectProvider(
  userId: string,
  provider: ConnectableProvider,
): Promise<DisconnectResult> {
  return provider === AuthProvider.Twitch
    ? disconnectTwitch(userId)
    : disconnectDiscord(userId);
}
