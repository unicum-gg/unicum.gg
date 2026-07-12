import { Region, REGION_API_HOST } from "../../region";
import type { Transport } from "../../client/transport";
import { WgLanguage } from "../../language";
import { buildQuery } from "../../query";

/** Layout of the WG login page, for the `display` parameter of `auth/login`. */
export enum AuthDisplay {
  Page = "page",
  Popup = "popup",
}

/** Result of `auth/login` — the WG OpenID page the user must be sent to. */
export type LoginRedirect = {
  /** URL the user is redirected to in order to authenticate. */
  location: string;
};

/** Result of `auth/prolongate` — a freshly minted access token. */
export type ProlongedToken = {
  access_token: string;
  account_id: number;
  expires_at: number;
};

/**
 * Wargaming.net ID (OpenID) authentication (`/wot/auth/*`). These endpoints
 * mint, extend, and revoke the `access_token` that unlocks the private fields
 * of other methods (e.g. `account.info` `private`, `tanks.stats` `in_garage`).
 */
export class AuthResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /**
   * `/wot/auth/login/` — begin the OpenID flow. Returns the WG login URL to
   * redirect the user to (the endpoint is always called with `nofollow=1` so
   * it yields the URL rather than issuing an HTTP redirect itself). After the
   * user authenticates, WG appends `access_token`, `expires_at`, `account_id`
   * and `nickname` to `redirectUri`.
   */
  async login(params: {
    /** URL WG sends the user back to after authentication. */
    redirectUri?: string;
    /** Page layout — `Page` (default) or `Popup` for mobile apps. */
    display?: AuthDisplay;
    /**
     * `access_token` expiration as a UNIX timestamp, or a delta in seconds.
     * Must not exceed two weeks from now.
     */
    expiresAt?: number;
    language?: WgLanguage;
  } = {}): Promise<LoginRedirect> {
    const query = buildQuery(params);
    query.nofollow = "1";
    if (params.redirectUri) query.redirect_uri = params.redirectUri;
    if (params.display) query.display = params.display;
    if (params.expiresAt !== undefined) query.expires_at = String(params.expiresAt);
    return this.t.wgFetch<LoginRedirect>(this.region, "/wot/auth/login/", query);
  }

  /**
   * `/wot/auth/login/` as a plain URL to send the *browser* to, with no server
   * round-trip. Where {@link login} calls WG (with `nofollow=1`) to resolve the
   * OpenID URL and hands it back, this just assembles the `/wot/auth/login/`
   * URL: WG then issues its own `302` to the OpenID page when the browser lands
   * there. So it makes no API call and never touches the rate limiter — the
   * user's browser makes the request, not us. Prefer it for the interactive
   * sign-in redirect; use {@link login} only when the resolved URL is needed
   * server-side.
   */
  loginUrl(params: {
    /** URL WG sends the user back to after authentication. */
    redirectUri?: string;
    /** Page layout — `Page` (default) or `Popup` for mobile apps. */
    display?: AuthDisplay;
    /** `access_token` expiration as a UNIX timestamp, or a delta in seconds. */
    expiresAt?: number;
    language?: WgLanguage;
  } = {}): string {
    const url = new URL(`https://${REGION_API_HOST[this.region]}/wot/auth/login/`);
    url.searchParams.set("application_id", this.t.applicationId(this.region));
    if (params.redirectUri) url.searchParams.set("redirect_uri", params.redirectUri);
    if (params.display) url.searchParams.set("display", params.display);
    if (params.expiresAt !== undefined) {
      url.searchParams.set("expires_at", String(params.expiresAt));
    }
    const language = params.language ?? this.t.defaultLanguage();
    if (language) url.searchParams.set("language", language);
    return url.toString();
  }

  /**
   * `/wot/auth/prolongate/` — mint a new `access_token` from a still-valid one,
   * for when the player keeps using the app past the current token's lifetime.
   */
  async prolongate(
    params: {
      accessToken: string;
      /**
       * New expiration as a UNIX timestamp, or a delta in seconds. Must not
       * exceed two weeks from now.
       */
      expiresAt?: number;
    },
    /**
     * `skipRateLimit` exempts this call from the per-region rate limiter, for
     * the interactive login path where verifying the token blocks the user and
     * must not queue behind background traffic.
     */
    opts?: { skipRateLimit?: boolean },
  ): Promise<ProlongedToken> {
    const query = buildQuery(params);
    if (params.expiresAt !== undefined) query.expires_at = String(params.expiresAt);
    return this.t.wgFetch<ProlongedToken>(this.region, "/wot/auth/prolongate/", query, {
      method: "POST",
      skipRateLimit: opts?.skipRateLimit,
    });
  }

  /**
   * `/wot/auth/logout/` — invalidate an `access_token`. The token is unusable
   * afterwards.
   */
  async logout(params: { accessToken: string }): Promise<void> {
    await this.t.wgFetch<null>(this.region, "/wot/auth/logout/", buildQuery(params), {
      method: "POST",
    });
  }
}
