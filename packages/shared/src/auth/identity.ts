import { isRegion, type Region } from "@unicum.gg/wargaming";

/** A player's World of Tanks identity: the realm the account lives on, and its id. */
export type WgIdentity = { region: Region; accountId: number };

/**
 * Read a WoT identity back out of the key the Wargaming sign-in stores.
 *
 * A WG account lives on exactly one realm and its id is only unique within it,
 * so the `account` row is keyed `<region>-<account id>` rather than on the id
 * alone. Four places had hand-rolled the same split (and disagreed on how:
 * `split("-")` against `indexOf`, which only happen to agree because a region
 * never carries a dash), each one ahead of a query that must not run on a
 * misread realm.
 *
 * Null for anything that is not one, which covers a missing row as much as a
 * malformed key: either way there is no identity to act for.
 */
export function wgIdentityFromAccountKey(
  key: string | null | undefined,
): WgIdentity | null {
  if (!key) return null;
  const dash = key.indexOf("-");
  if (dash < 0) return null;
  const region = key.slice(0, dash);
  const accountId = Number(key.slice(dash + 1));
  // A safe integer, not merely finite: this guards the queries that run on
  // the realm and the id, and `Number.isFinite` lets 1.5 through.
  return isRegion(region) && Number.isSafeInteger(accountId) && accountId > 0
    ? { region, accountId }
    : null;
}

/** The key above, built from an identity. */
export function wgAccountKey(identity: WgIdentity): string {
  return `${identity.region}-${identity.accountId}`;
}
