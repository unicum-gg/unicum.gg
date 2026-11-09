import { createHash } from "node:crypto";
import {
  isRegion,
  WargamingApiError,
  WargamingHttpError,
  type Region,
} from "@unicum.gg/wargaming";
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

/**
 * How long a refusal is remembered, against the hour a success gets.
 *
 * A client whose token expired mid-session gets a fresh one from the game and
 * must not be locked out for an hour by the answer about the old one.
 */
const REFUSAL_TTL_SECONDS = 60;

/** A Wargaming account a client proved it is playing on. */
export interface GameClientAccount {
  region: Region;
  accountId: number;
}

/**
 * What asking Wargaming about a client's token produced.
 *
 * A refusal carries Wargaming's own word for it rather than collapsing to
 * null, because the one thing a refused client cannot find out for itself is
 * why. Nothing in here describes anybody else: the token is the caller's, and
 * so is the verdict.
 */
export type GameTokenVerdict =
  | { account: GameClientAccount }
  | { refused: string };

/** Wargaming's own word for a refusal, or ours when it never answered. */
function refusalOf(err: unknown): string {
  // The code is the whole point of keeping this. `INVALID_ACCESS_TOKEN` says
  // the token is not one this application may read, which is a different
  // thing from a token that has expired, and both are different from
  // Wargaming being down.
  if (err instanceof WargamingApiError) return `wg:${err.code}`;
  if (err instanceof WargamingHttpError) return `wg_http:${err.status}`;
  return "wg_unreachable";
}

/**
 * Who Wargaming says a client's WGNI token belongs to, or why it would not say.
 *
 * The token is never used as a cache key: it is a live credential, and Redis
 * here is shared with the ISR page cache. Its SHA-256 identifies it just as
 * well and is worthless to anyone who reads the store.
 */
export async function verifyGameToken(
  region: string,
  token: string,
): Promise<GameTokenVerdict> {
  if (!isRegion(region)) return { refused: "bad_region" };
  if (!token) return { refused: "no_token" };
  const digest = createHash("sha256").update(token, "utf8").digest("hex");
  // `v2` because the stored shape changed: v1 kept a bare account id or null,
  // and a reader of this shape cannot tell which of the two it is holding.
  return cachedInRedis<GameTokenVerdict>(
    `game-token:v2:${region}:${digest}`,
    (verdict) =>
      "account" in verdict ? VERIFY_TTL_SECONDS : REFUSAL_TTL_SECONDS,
    async () => {
      // Skip the shared limiter for the same reason the sign-in callback does:
      // a player's client is waiting on this, and it must not queue behind the
      // crons' background traffic.
      try {
        const verified = await wg
          .region(region)
          .api.wot.auth.prolongate(
            { accessToken: token },
            { skipRateLimit: true },
          );
        return { account: { region, accountId: verified.account_id } };
      } catch (err) {
        return { refused: refusalOf(err) };
      }
    },
  );
}
