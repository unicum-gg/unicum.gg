/**
 * A sliding window per caller, for the endpoints whose cost is not in the
 * database.
 *
 * Three routes now need one and each had hand-rolled the same ten lines, which
 * is how two of them ended up with the window spelled out twice and no way to
 * tell at a glance whether they agreed. The shape is always the same: remember
 * when a key last acted, forget what has aged out, refuse when what is left
 * fills the allowance.
 *
 * Best-effort and per-instance, deliberately. The web runs as a PM2 cluster, so
 * a caller could in principle get one allowance per worker: that is enough to
 * stop a script, which is what this is for, and nothing here is a
 * distributed-systems guarantee. The limits that must hold across the fleet
 * (the Wargaming budget) are in Redis instead.
 *
 * What it protects is never the row. The rating endpoints upsert, so a loop
 * that rewrites its own vote produces one tidy row however many times it is
 * called; what it also produces is an unbounded stream of moderation cards into
 * a channel a human reads. That is the cost being limited.
 */
export type RateLimiter = {
  /** True when this key has used up its allowance. Records the attempt when it
   * has not, so a caller is never charged for a refusal. */
  limited: (key: string) => boolean;
};

export function createRateLimiter({
  limit,
  windowMs,
}: {
  /** Actions allowed inside the window. */
  limit: number;
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    limited(key: string): boolean {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        // Written back pruned even on a refusal, so a key that keeps hitting
        // the wall does not keep growing its own array for ever.
        hits.set(key, recent);
        return true;
      }
      recent.push(now);
      hits.set(key, recent);
      return false;
    },
  };
}

/** One minute, which is the window all three callers chose independently. */
export const RATE_LIMIT_WINDOW_MS = 60_000;
