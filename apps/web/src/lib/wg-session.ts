import { isRegion, type Region } from "@unicum.gg/wargaming";

/**
 * Recover a signed-in player's WoT identity from their synthetic auth email
 * (`<accountId>@<region>.wargaming.local`). Better Auth generates its own opaque
 * user id, so the region/account_id can't be read off `session.user.id` — the
 * email is the stable carrier.
 */
export function wgIdentityFromEmail(
  email: string | null | undefined,
): { region: Region; accountId: number } | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return null;
  const accountId = Number(email.slice(0, at));
  const region = email.slice(at + 1).split(".")[0];
  return Number.isFinite(accountId) && isRegion(region)
    ? { region, accountId }
    : null;
}
