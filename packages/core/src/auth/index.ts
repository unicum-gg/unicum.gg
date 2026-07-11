import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@unicum.gg/core/db";
import { env } from "@unicum.gg/core/env";
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
  account: { encryptOAuthTokens: true },
  plugins: [wargaming()],
});
