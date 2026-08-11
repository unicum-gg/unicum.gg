import { eq, sql } from "drizzle-orm";
import { changelogState } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * How far the changelog has been published, as the last commit it covered.
 *
 * Postgres, not Redis. The first version was a Redis key, on the reasoning that
 * one string surviving a redeploy needs no schema. It survived redeploys and
 * was lost to something else: the instance runs `allkeys-lru` at its memory
 * ceiling, where a key with no TTL is evicted like any other, and this one is
 * read once a day, in a store shared with the ISR page cache. Evicted between
 * two runs, it made the next one read nothing, fall back to its time window and
 * publish the previous day's entries a second time.
 *
 * A row cannot be evicted, which is the whole requirement: this value is not a
 * cache, it is the only record of what the channel has already been told.
 */

/** The singleton row's id, enforced by a check constraint on the table. */
const ROW_ID = 1;

export async function readLastPublished(): Promise<string | null> {
  try {
    const [row] = await db
      .select({ sha: changelogState.lastPublishedSha })
      .from(changelogState)
      .where(eq(changelogState.id, ROW_ID))
      .limit(1);
    return row?.sha ?? null;
  } catch (err) {
    // A read failure must not be mistaken for "nothing published yet": that is
    // what republishes a batch. Rethrow so the caller aborts the run instead.
    console.error("[changelog] could not read the published sha:", err);
    throw err;
  }
}

export async function writeLastPublished(sha: string): Promise<void> {
  // Best-effort, deliberately: this runs after Discord has accepted the post,
  // so throwing here would report a failure for an update the channel already
  // received. A lost write means the next run re-covers this batch, which the
  // writer turns into a near-duplicate post, hence the loud line.
  await db
    .insert(changelogState)
    .values({ id: ROW_ID, lastPublishedSha: sha })
    .onConflictDoUpdate({
      target: changelogState.id,
      set: { lastPublishedSha: sha, publishedAt: sql`NOW()` },
    })
    .catch((err) => {
      console.error("[changelog] could not persist the published sha:", err);
    });
}
