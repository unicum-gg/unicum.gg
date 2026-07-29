import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { account as accountTable, env } from "@unicum.gg/shared";
import { getTwitchUsersById, isTwitchEnabled } from "@unicum.gg/core/twitch";
import { upsertStreamer } from "@unicum.gg/core/twitch/streamers";
import { isRegion } from "@unicum.gg/wargaming";
import { wargaming } from "./wargaming";

/**
 * Better Auth instance. Identity is Wargaming.net ID only (no email/password,
 * no standard social provider); the WG OpenID flow lives in the `wargaming`
 * plugin, which mints a Better Auth session from the token WG hands back. User,
 * session, and account rows are stored in Postgres via the Drizzle adapter
 * (global tables, unlike the per-region game data).
 */
// Fail fast on the web if the key is missing, rather than letting Better Auth
// silently mint a throwaway secret (which would invalidate every session on
// each restart). The worker never imports this module, so it stays unaffected.
if (!env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required to run authentication");
}

export const auth = betterAuth({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: false },
  // The WG access token unlocks the player's private WG data, so encrypt it at
  // rest rather than storing it verbatim in the `account` table. Better Auth
  // encrypts it with the app secret on write and decrypts on read.
  account: {
    encryptOAuthTokens: true,
    // WG never returns an email, so a WG user's email is a synthetic
    // `<id>@<region>.wargaming.local` that can never match a real Twitch email.
    // Better Auth's default account-linking guard rejects that mismatch with
    // `email_doesn't_match`, so allow linking across different emails: the user
    // is already authenticated as this WG account and links their own Twitch via
    // OAuth (which proves ownership), so there is no takeover risk.
    accountLinking: {
      allowDifferentEmails: true,
    },
  },
  // Social providers are offered only for LINKING (a logged-in WG player
  // connecting an account), never as a primary login. Absent creds → omitted.
  //  - twitch: connect a channel (live rail/badges).
  //  - discord: the single canonical Discord identity link, used by the supporter
  //    role. `guilds.join` lets us add the user to our server before the bot grants
  //    the role; `identify` reads their id. Their token is stored (encrypted) so
  //    `getAccessToken` can hand it back for the add-to-guild call.
  socialProviders: {
    ...(isTwitchEnabled()
      ? {
          twitch: {
            clientId: env.TWITCH_CLIENT_ID as string,
            clientSecret: env.TWITCH_CLIENT_SECRET as string,
          },
        }
      : {}),
    ...(env.DISCORD_APP_ID && env.DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: env.DISCORD_APP_ID,
            clientSecret: env.DISCORD_CLIENT_SECRET,
            scope: ["identify", "guilds.join"],
          },
        }
      : {}),
  },
  databaseHooks: {
    account: {
      create: {
        // When a player links Twitch, record the verified WoT↔Twitch mapping so
        // they surface in the live rail/badges. The auth user id is
        // `${region}-${accountId}`; the Twitch `sub` resolves to the login via
        // Helix. Non-WG users (no such id) are ignored.
        after: async (twitchAccount) => {
          if (twitchAccount.providerId !== "twitch") return;
          // Better Auth mints its own opaque user id, so recover the WG identity
          // from this user's linked wargaming account row, whose accountId is
          // `${region}-${accountId}`.
          const [wg] = await db
            .select({ accountId: accountTable.accountId })
            .from(accountTable)
            .where(
              and(
                eq(accountTable.userId, twitchAccount.userId),
                eq(accountTable.providerId, "wargaming"),
              ),
            )
            .limit(1);
          if (!wg) return;
          const dash = wg.accountId.indexOf("-");
          if (dash < 0) return;
          const region = wg.accountId.slice(0, dash);
          const accountId = Number(wg.accountId.slice(dash + 1));
          if (!isRegion(region) || !Number.isFinite(accountId)) return;
          const [twitchUser] = await getTwitchUsersById([
            twitchAccount.accountId,
          ]);
          if (!twitchUser) return;
          await upsertStreamer({
            region,
            accountId,
            twitchLogin: twitchUser.login,
            twitchUserId: twitchUser.id,
            verified: true,
          });
        },
      },
    },
  },
  plugins: [wargaming()],
});
