import { createAuthClient } from "better-auth/react";
import { multiSessionClient } from "better-auth/client/plugins";

/**
 * Browser-side Better Auth client. Talks to the same-origin `/api/auth`
 * handler. Sign-in is the Wargaming.net ID redirect (not a standard provider),
 * so callers link to `/api/auth/sign-in/wargaming?region=<r>` directly; this
 * client is used for reading the session, signing out, and switching between
 * the accounts signed in on this browser (`multiSession`).
 */
export const authClient = createAuthClient({
  plugins: [multiSessionClient()],
});

export const { useSession, signOut } = authClient;
