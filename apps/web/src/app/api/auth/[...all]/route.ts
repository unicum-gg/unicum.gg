import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@unicum.gg/core/auth";

/**
 * Better Auth catch-all handler. Mounts every auth endpoint under `/api/auth/*`,
 * including the Wargaming.net ID plugin:
 *   - `/api/auth/sign-in/wargaming?region=<r>` starts the WG OpenID redirect
 *   - `/api/auth/callback/wargaming` finishes it and sets the session cookie
 */
export const { GET, POST } = toNextJsHandler(auth);
