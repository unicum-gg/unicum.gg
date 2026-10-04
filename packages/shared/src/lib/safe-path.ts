/**
 * Constrain a caller-supplied destination to a same-origin relative path.
 *
 * Every flow that hands a URL to a redirect after leaving the site (signing in
 * with Wargaming, linking a Discord account) takes where to come back to from
 * the request, which is an open redirect the moment it is trusted: a crafted
 * `callbackURL` would make our own sign-in page forward to somebody else's.
 *
 * Shared rather than written once per flow, because a second copy of a guard
 * like this is the one that does not get the fix.
 *
 * Rejects `//host` and `/\host` (browsers read the backslash form as
 * protocol-relative) and any backslash anywhere.
 */
export function safePath(raw: string | undefined | null): string {
  return raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
    ? raw
    : "/";
}
