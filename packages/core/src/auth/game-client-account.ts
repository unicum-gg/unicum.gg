import { createHash } from "node:crypto";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { wg } from "@unicum.gg/core/wargaming/client";
import { cachedInRedis } from "@unicum.gg/core/redis";

/**
 * Which Wargaming account a game client is really playing on.
 *
 * The mod sends things about its own player that nobody else may send in their
 * name: how they have set their vehicles up, and whatever follows. A nickname
 * in the body would be a claim rather than a fact, and the value of this data
 * rests entirely on nobody being able to publish nonsense under a good
 * player's name, so the account has to be PROVEN on every upload.
 *
 * The proof the client can always give is its own WGNI web token, the one the
 * game mints for its shop and its portal. `wot/auth/prolongate` succeeds only
 * for a genuine token and echoes back the account id it is bound to, which is
 * the same check the site's own Wargaming sign-in makes. The token never
 * identifies anyone but its holder, so a stolen one buys the thief nothing
 * except the right to describe the account it already belongs to.
 *
 * This asks nothing of the player. It is deliberately NOT the account link,
 * which is a sign-in the player has to perform: most people running the mod
 * have never signed in here, and a feature that only worked for those who had
 * would describe the wrong half of the playerbase.
 */

/**
 * How long a verified token is trusted without asking Wargaming again.
 *
 * An hour rather than the token's own expiry, which runs to a fortnight: the
 * cache is here so a carousel sweep costs one WG call instead of one per
 * batch, not so a revoked token keeps working for two weeks. Wargaming's rate
 * limits are the reason the cache exists at all (a few thousand players
 * uploading on every garage entry would otherwise be a few thousand calls into
 * a budget the crons already share).
 */
const VERIFY_TTL_SECONDS = 3600;

/** A Wargaming account a client proved it is playing on. */
export interface GameClientAccount {
  region: Region;
  accountId: number;
}

/**
 * The account behind a client's WGNI token, or null when Wargaming rejects it.
 *
 * The token is never used as a cache key: it is a live credential, and Redis
 * here is shared with the ISR page cache. Its SHA-256 identifies it just as
 * well and is worthless to anyone who reads the store.
 */
export async function accountBehindGameToken(
  region: string,
  token: string,
): Promise<GameClientAccount | null> {
  if (!isRegion(region) || !token) return null;
  const digest = createHash("sha256").update(token, "utf8").digest("hex");
  const accountId = await cachedInRedis(
    `game-token:${region}:${digest}`,
    // A rejected token is remembered for a minute rather than an hour: a
    // client whose token expired mid-session gets a fresh one and must not be
    // locked out for an hour by the answer about the old one.
    (value: number | null) => (value === null ? 60 : VERIFY_TTL_SECONDS),
    async () => {
      // Skip the shared limiter for the same reason the sign-in callback does:
      // a player's client is waiting on this, and it must not queue behind the
      // crons' background traffic.
      const verified = await wg
        .region(region)
        .api.wot.auth.prolongate({ accessToken: token }, { skipRateLimit: true })
        .catch(() => null);
      return verified ? verified.account_id : null;
    },
  );
  return accountId === null ? null : { region, accountId };
}
