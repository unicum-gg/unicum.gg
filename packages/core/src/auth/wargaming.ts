import * as z from "zod";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import { isRegion } from "@unicum.gg/wargaming";
import { wg } from "@unicum.gg/core/wargaming/client";
import { env } from "@unicum.gg/shared";

const PROVIDER_ID = "wargaming";

// WG OpenID rejects any `redirect_uri` that carries a query string ("Bad
// redirect_uri"), so the region and the post-login destination cannot ride
// along in the callback URL. They travel in a short-lived signed cookie set at
// sign-in instead, which doubles as the CSRF guard: the callback only proceeds
// when it can read back a cookie that we signed. WG appends its own params
// (status/access_token/account_id/nickname/expires_at) to the bare redirect_uri.
const STATE_COOKIE = "wargaming_state";

// WG accounts are per-region and account_id only collides across regions, so we
// key both the Better Auth user id and the linked account on `<region>-<id>`.
// WG never returns an email, so we synthesise a stable, non-routable one and
// mark it verified (the identity is asserted by WG's own login).
function synthEmail(region: string, accountId: string): string {
  return `${accountId}@${region}.wargaming.local`;
}

function appUrl(path: string): string {
  return path.startsWith("http") ? path : `${env.NEXT_PUBLIC_APP_URL}${path}`;
}

// Only accept a same-origin relative path as the post-login destination, so a
// crafted `callbackURL` can never turn sign-in into an open redirect. Reject
// `//host` and `/\host` (browsers treat the backslash form as protocol-relative)
// and any backslash anywhere.
function safePath(raw: string | undefined): string {
  return raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
    ? raw
    : "/";
}

/**
 * Wargaming.net ID (OpenID) sign-in for Better Auth. WG isn't OAuth2/OIDC — its
 * `/wot/auth/login/` hands the `access_token` back on the callback redirect with
 * no code exchange — so this can't be a standard provider. Instead two custom
 * endpoints drive the redirect and, on return, mint a Better Auth session from
 * the token via `handleOAuthUserInfo` + `setSessionCookie`.
 */
export function wargaming(): BetterAuthPlugin {
  return {
    id: "wargaming",
    endpoints: {
      wargamingSignIn: createAuthEndpoint(
        "/sign-in/wargaming",
        {
          method: "GET",
          query: z.object({
            region: z.string(),
            callbackURL: z.string().optional(),
          }),
        },
        async (ctx) => {
          const { region } = ctx.query;
          if (!isRegion(region)) throw ctx.redirect(appUrl("/?auth=bad_region"));
          const callbackURL = safePath(ctx.query.callbackURL);
          // Anti-CSRF nonce. WG echoes back none of our params, but it appends
          // its response to the redirect_uri *path* untouched — so the nonce
          // rides in the path and is matched against the signed cookie on
          // return. An attacker can't forge the signed, HttpOnly cookie, so a
          // login can only ever complete in the browser that started it.
          const nonce = crypto.randomUUID();
          // No query string on the redirect_uri (WG rejects any); the nonce
          // travels as a path segment, region + destination in the cookie.
          const redirectUri = `${ctx.context.baseURL}/callback/wargaming/${nonce}`;
          const stateCookie = ctx.context.createAuthCookie(STATE_COOKIE, {
            maxAge: 600,
          });
          await ctx.setSignedCookie(
            stateCookie.name,
            JSON.stringify({ region, callbackURL, nonce }),
            ctx.context.secret,
            stateCookie.attributes,
          );
          // Redirect the browser straight to WG's login endpoint, which issues
          // its own 302 onward to the OpenID page. Unlike calling `login()`
          // server-side (a WG API round-trip through the shared per-region rate
          // limiter, which queues behind background traffic and froze the click
          // for 1-3s), this builds the URL locally: the sign-in redirect is
          // instant and makes no WG call.
          const location = wg
            .region(region)
            .api.wot.auth.loginUrl({ redirectUri });
          throw ctx.redirect(location);
        },
      ),
      wargamingCallback: createAuthEndpoint(
        "/callback/wargaming/:nonce",
        {
          method: "GET",
          // `account_id`/`expires_at` are also appended by WG but are NOT read
          // from here — they are unsigned and forgeable, so identity is taken
          // from the verified token below, never from the incoming URL.
          query: z.object({
            status: z.string().optional(),
            access_token: z.string().optional(),
            nickname: z.string().optional(),
          }),
        },
        async (ctx) => {
          const stateCookie = ctx.context.createAuthCookie(STATE_COOKIE);
          const raw = await ctx.getSignedCookie(
            stateCookie.name,
            ctx.context.secret,
          );
          // One-shot cookie: clear it regardless of how the callback resolves.
          ctx.setCookie(stateCookie.name, "", {
            ...stateCookie.attributes,
            maxAge: 0,
          });
          if (!raw) throw ctx.redirect(appUrl("/?auth=error"));
          let region: string;
          let callbackURL: string;
          let nonce: string;
          try {
            const parsed = JSON.parse(raw) as {
              region?: string;
              callbackURL?: string;
              nonce?: string;
            };
            region = parsed.region ?? "";
            callbackURL = safePath(parsed.callbackURL);
            nonce = parsed.nonce ?? "";
          } catch {
            throw ctx.redirect(appUrl("/?auth=error"));
          }
          // Login-CSRF guard: the nonce WG returned in the path must match the
          // one we signed into the cookie at sign-in. A forged completion won't
          // carry the victim's (unforgeable) cookie nonce, so it is rejected.
          if (!nonce || ctx.params.nonce !== nonce) {
            throw ctx.redirect(appUrl("/?auth=error"));
          }
          const { status, access_token, nickname } = ctx.query;
          if (!isRegion(region) || status !== "ok" || !access_token) {
            throw ctx.redirect(appUrl("/?auth=error"));
          }
          // WG hands back `access_token`/`account_id` as PLAIN, unsigned query
          // params (it isn't OIDC — nothing is signed), so a forged callback
          // with someone else's account_id would otherwise mint their session.
          // Verify the token with WG: `prolongate` only succeeds for a genuine
          // token and echoes back the account_id it is actually bound to (plus
          // a fresh token + expiry). Identity comes from THIS response, and a
          // rejected token drops the login.
          // Skip the shared rate limiter: this token check is interactive (the
          // user is waiting on the callback to finish logging them in), so it
          // must not queue behind background WG traffic like the crons do.
          const verified = await wg
            .region(region)
            .api.wot.auth.prolongate(
              { accessToken: access_token },
              { skipRateLimit: true },
            )
            .catch(() => null);
          if (!verified) throw ctx.redirect(appUrl("/?auth=error"));
          const accountId = String(verified.account_id);
          const uid = `${region}-${accountId}`;
          const result = await handleOAuthUserInfo(ctx, {
            userInfo: {
              id: uid,
              email: synthEmail(region, accountId),
              name: nickname ?? `Player ${accountId}`,
              emailVerified: true,
            },
            account: {
              providerId: PROVIDER_ID,
              accountId: uid,
              accessToken: verified.access_token,
              accessTokenExpiresAt: new Date(verified.expires_at * 1000),
            },
            disableSignUp: false,
          });
          if (result.error || !result.data) {
            throw ctx.redirect(appUrl("/?auth=error"));
          }
          await setSessionCookie(ctx, result.data);
          throw ctx.redirect(appUrl(callbackURL));
        },
      ),
    },
  };
}
