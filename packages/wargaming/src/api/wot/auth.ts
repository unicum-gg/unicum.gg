import { Region } from "../../region";
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
   * `/wot/auth/prolongate/` — mint a new `access_token` from a still-valid one,
   * for when the player keeps using the app past the current token's lifetime.
   */
  async prolongate(params: {
    accessToken: string;
    /**
     * New expiration as a UNIX timestamp, or a delta in seconds. Must not
     * exceed two weeks from now.
     */
    expiresAt?: number;
  }): Promise<ProlongedToken> {
    const query = buildQuery(params);
    if (params.expiresAt !== undefined) query.expires_at = String(params.expiresAt);
    return this.t.wgFetch<ProlongedToken>(this.region, "/wot/auth/prolongate/", query, {
      method: "POST",
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
