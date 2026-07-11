import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Talks to the same-origin `/api/auth`
 * handler. Sign-in is the Wargaming.net ID redirect (not a standard provider),
 * so callers link to `/api/auth/sign-in/wargaming?region=<r>` directly; this
 * client is used for reading the session and signing out.
 */
export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;
