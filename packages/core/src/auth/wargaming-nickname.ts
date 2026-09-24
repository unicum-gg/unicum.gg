import type { Region } from "@unicum.gg/wargaming";
import { getAccountNickname } from "@unicum.gg/core/wargaming/wot/accounts";
import { getPlayersByAccountIds } from "@unicum.gg/core/players/search-local";

/**
 * The name an account answers to, resolved from a VERIFIED account id.
 *
 * WG appends `nickname` to the login callback as a plain, unsigned query param,
 * exactly like `account_id`, so it is the caller's to choose. Reading it there
 * let anyone holding a token of their own sign up under any name they liked,
 * and that name is not private: it is what the community tank ratings, the
 * supporter wall and the video submissions print. So the callback resolves the
 * name from the account id `prolongate` confirmed the token is bound to, and
 * never from the URL it arrived on.
 *
 * **Wargaming first here, unlike `resolveAccountByNickname`, which reads our
 * own table first.** That one serves page views, where the local row is the
 * common case and the answer is recomputed on every request. This runs once per
 * login, which is rare enough to afford the round-trip, and what it returns is
 * written into a stored record that is then published, so it is worth being
 * current rather than as-of-our-last-refresh. Our players table is the fallback
 * for when WG does not answer, so a blip costs a first-time player their name
 * rather than the login.
 *
 * Null when neither could name the account. The caller must NOT fall back to
 * the URL for that case, which is the hole this closes.
 */
export async function resolveVerifiedNickname(
  region: Region,
  accountId: number,
): Promise<string | null> {
  const fromWargaming = await getAccountNickname(region, accountId).catch(
    (err) => {
      console.warn("[auth] account/info failed resolving a nickname:", err);
      return null;
    },
  );
  if (fromWargaming) return fromWargaming;

  const [local] = await getPlayersByAccountIds(region, [accountId]).catch(
    () => [],
  );
  // Blank is not a name, and our own table really does hold blank ones, on all
  // three regions and on ordinary account ids rather than a single junk row.
  // Returned as-is one would pass the `!== null` test the callback gates
  // `overrideUserInfo` on, so the player would be renamed to nothing instead
  // of falling back to the `Player <id>` placeholder. Wargaming answers null
  // for those accounts, so this only ever bites through the fallback.
  return local?.nickname?.trim() || null;
}
