import { auth } from "@unicum.gg/core/auth";
import { env } from "@unicum.gg/shared";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Wargaming sign-in for the game mod, which opens the player's own browser on
 * `/api/connect/game/<hash>#account_id=...&token=...`.
 *
 * The fragment carries the game's WGNI web token, which signs a browser in on
 * wargaming.net with no password (`/id/signin/token/`, the way the client opens
 * the Wargaming shop). A fragment never reaches a server, so the token goes from
 * the game to Wargaming without passing through ours.
 *
 * The sign-in itself is our usual one: its endpoint is called here so the signed
 * state cookie is set on this response, and the page then sends the browser
 * through Wargaming's token sign-in with `next` pointing at the OpenID URL that
 * endpoint resolved. Wargaming follows a `next` on its own domain only, which
 * the OpenID URL is; with no token in the fragment the page goes to OpenID
 * directly, as an ordinary sign-in.
 */
export async function gameSignInResponse(
  requestHeaders: Headers,
  region: Region,
  callbackURL: string,
): Promise<Response | null> {
  // Through Better Auth's router rather than `auth.api`: the plugin is typed as
  // a plain BetterAuthPlugin, so its endpoints are not on the typed API.
  const signIn = await auth
    .handler(
      new Request(
        `${env.NEXT_PUBLIC_APP_URL}${ROUTES.AUTH_SIGN_IN(region, callbackURL)}`,
        { headers: requestHeaders },
      ),
    )
    .catch(() => null);
  const location = signIn?.headers.get("location");
  if (!signIn || !location) return null;
  let openId: URL;
  try {
    openId = new URL(location);
  } catch {
    return null;
  }
  // Only a Wargaming portal may receive the token.
  if (!openId.hostname.endsWith(".wargaming.net")) return null;

  const script = `(function () {
  var next = ${JSON.stringify(openId.toString())};
  var params = new URLSearchParams(location.hash.slice(1));
  var account = params.get("account_id"), token = params.get("token");
  if (account && token && /^\\d+$/.test(account)) {
    var query = new URLSearchParams({ account_id: account, token: token, continue_on_failure: "1", next: next });
    location.replace(${JSON.stringify(`${openId.origin}/id/signin/token/`)} + "?" + query.toString());
  } else {
    location.replace(next);
  }
})();`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>unicum.gg</title></head><body><script>${script}</script></body></html>`;

  const res = new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
  const setCookies = (
    signIn.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  for (const cookie of setCookies ?? []) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
