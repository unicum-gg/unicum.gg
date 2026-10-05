import { wgIdentityFromAccountKey, type WgIdentity } from "@unicum.gg/shared";
import { accountBehindGameToken } from "@unicum.gg/core/auth/game-client-account";
import { wargamingAccountOf } from "@unicum.gg/core/game-link";
import { gameClientUser } from "@/services/game";

export type ProvenAccount = WgIdentity;

/**
 * The Wargaming account a game-mod request may speak for, or null.
 *
 * Every endpoint the mod writes to needs this and needs it to mean the same
 * thing, which is why it lives here rather than in one route: what the mod
 * sends is only ever a statement about the caller's OWN account, and the value
 * of everything it publishes rests on nobody being able to write under
 * somebody else's name. A nickname in a body would be a claim. This is a fact.
 *
 * Proven two ways, and neither asks anything of the player:
 *
 * - a client whose player has linked their unicum.gg account authenticates
 *   with the link's own secret, and the account comes from the link;
 * - any other client sends its **WGNI web token**, the one the game mints for
 *   its own shop and portal, and Wargaming is asked whose it is.
 *
 * The second is the one that matters, because most people running the mod have
 * never signed in here and a feature that only worked for those who had would
 * describe the wrong half of the playerbase.
 *
 * The link is preferred because it costs no call to Wargaming. It carries one
 * cost of its own, worth knowing before leaning on the region it reports: a
 * link's realm is the one the player signed in with on unicum.gg, not the one
 * the client in front of them is playing. Anything that writes per region
 * should check what it was handed against what the payload itself says (the
 * battle endpoint does, against the cluster in the results).
 */
export async function provenAccount(
  req: Request,
): Promise<ProvenAccount | null> {
  const linked = await linkedAccount(req);
  if (linked) return linked;
  const token = req.headers.get("x-wargaming-token");
  const region = req.headers.get("x-wargaming-region");
  if (!token || !region) return null;
  return accountBehindGameToken(region, token);
}

/** The account behind a linked client's bearer secret, when there is one. */
async function linkedAccount(req: Request): Promise<ProvenAccount | null> {
  const client = await gameClientUser(req);
  if (!client) return null;
  // `<region>-<account id>`, as the Wargaming sign-in stores it, read by the
  // one reader there is for that key rather than split here again.
  return wgIdentityFromAccountKey(await wargamingAccountOf(client.userId));
}
