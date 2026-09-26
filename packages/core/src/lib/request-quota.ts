import { getRedisClient } from "@unicum.gg/core/redis";

/**
 * How often one caller may do something, counted in a fixed window.
 *
 * Written for the game mod's upload, which is the first endpoint here that a
 * client writes to rather than reads from. The account behind an upload is
 * proven, so nobody can write in somebody else's name, but a proven account
 * can still hammer the route: it would only ever damage its own rows, and it
 * would make the database pay for that all the same.
 *
 * A fixed window rather than a token bucket, because the traffic it governs is
 * bursty by nature and that is fine: a mod entering the garage uploads its
 * whole carousel at once and then says nothing for an hour. What must be
 * stopped is the loop, not the burst.
 *
 * **It fails open**, like everything else here that leans on Redis: no Redis,
 * or a Redis that blinks, means no shared limit rather than a refused upload.
 * The limit protects the database from an abusive client; losing it for a
 * minute costs far less than turning a cache blip into an outage for every
 * player running the mod.
 */
export interface Quota {
  /** How many calls the window allows. */
  limit: number;
  /** How long the window lasts, in seconds. */
  windowSeconds: number;
}

export interface QuotaVerdict {
  allowed: boolean;
  /** Calls left in this window, for a `Retry-After`-style hint. */
  remaining: number;
  /** Seconds until the window resets, when the caller is over. */
  resetSeconds: number;
}

/**
 * Count one call against `key`'s quota and say whether it may proceed.
 *
 * The window is derived from the clock rather than from the first call, so a
 * caller cannot keep a window alive by calling into it: every key rolls over
 * at the same instants, and a caller that is over waits at most one window.
 */
export async function consumeQuota(
  key: string,
  { limit, windowSeconds }: Quota,
): Promise<QuotaVerdict> {
  const redis = getRedisClient();
  if (!redis) {
    return { allowed: true, remaining: limit, resetSeconds: 0 };
  }
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / windowSeconds);
  const resetSeconds = (window + 1) * windowSeconds - now;
  try {
    const counted = await redis.incr(`quota:${key}:${window}`);
    if (counted === 1) {
      // Only the call that opened the window sets the expiry, so a busy key
      // cannot keep pushing its own deadline out.
      await redis.expire(`quota:${key}:${window}`, windowSeconds + 1);
    }
    return {
      allowed: counted <= limit,
      remaining: Math.max(0, limit - counted),
      resetSeconds,
    };
  } catch {
    return { allowed: true, remaining: limit, resetSeconds: 0 };
  }
}
