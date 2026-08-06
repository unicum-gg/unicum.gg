import { getRedisClient } from "@unicum.gg/core/redis";

/**
 * How far the changelog has been published, as the last commit it covered.
 *
 * Redis rather than a table: it is one string that has to survive a redeploy,
 * which is exactly what a key gives us, with no schema and no migration. No
 * Redis (local dev) degrades to "nothing published yet", so the caller falls
 * back to a time window.
 */

const KEY = "changelog:last-published-sha";

export async function readLastPublished(): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  return redis.get(KEY).catch(() => null);
}

export async function writeLastPublished(sha: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  // Best-effort: a failed write means the next run re-covers this batch, which
  // the writer would turn into a near-duplicate post. Worth a loud line.
  await redis.set(KEY, sha).catch((err) => {
    console.error("[changelog] could not persist the published sha:", err);
  });
}
