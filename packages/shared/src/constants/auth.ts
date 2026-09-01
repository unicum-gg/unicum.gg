/**
 * Region of the player's Wargaming ACCOUNT, as opposed to the region they are
 * browsing (`unicum.region`). It lives here rather than in the web's `STORAGE`
 * map because both sides of the login need the same name: the WG callback in
 * `@unicum.gg/core/auth` writes it once a login has actually been verified, and
 * the web reads it in the login modal and in the server-side resume points.
 *
 * Readable by the browser on purpose (no `HttpOnly`): it is a preference, not a
 * credential, and the picker reads it client-side.
 */
export const AUTH_REGION_COOKIE = "unicum.auth-region";

/** One year, matching the other `unicum.*` preference cookies. */
export const AUTH_REGION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
