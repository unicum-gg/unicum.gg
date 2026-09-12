import { eq, sql } from "drizzle-orm";
import { changelogState } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * How far the changelog has been published, and when it last ran.
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

/** Attempts for the marker write. It runs after Discord has accepted the post,
 * so a lost write is not a failed publish: it is a batch the next run covers
 * again, which the writer turns into a second copy of an update the channel has
 * already read. That used to be a week away, with a loud line in the meantime
 * for someone to catch, and the catch-up in `./cron` brings it within hours, so
 * the write is worth insisting on. */
const WRITE_ATTEMPTS = 3;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export type ChangelogState = {
  /** Full SHA of the last commit a published changelog covered. */
  sha: string;
  /**
   * When the digest last ran to completion, whatever it had to say.
   *
   * The column is `published_at`, and it is stamped by all three endings that
   * leave the channel up to date: an update posted, a batch the model found
   * nothing player-visible in, and a window that landed no commits at all. That
   * is the fact the catch-up in `./cron` reads, since none of the three is a
   * reason to run again.
   */
  lastRunAt: Date;
};

/**
 * The singleton row, or null when nothing has ever been published.
 *
 * One read for both facts, and so one error policy: a failure rethrows, because
 * neither field may quietly degrade to "nothing yet". Read as "nothing
 * published" it republishes a batch, and read as "never ran" it publishes off
 * schedule. Rethrowing aborts the run instead, which costs a tick.
 */
export async function readChangelogState(): Promise<ChangelogState | null> {
  try {
    const [row] = await db
      .select({
        sha: changelogState.lastPublishedSha,
        lastRunAt: changelogState.publishedAt,
      })
      .from(changelogState)
      .where(eq(changelogState.id, ROW_ID))
      .limit(1);
    return row ?? null;
  } catch (err) {
    console.error("[changelog] could not read the state row:", err);
    throw err;
  }
}

/** How far the changelog has been published. Never throws in the end: the post
 * has already happened by the time this runs, so reporting a failure for it
 * would be a lie, and the loud line is what the next run's near-duplicate is
 * explained by. */
export async function writeLastPublished(sha: string): Promise<void> {
  for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt += 1) {
    try {
      await db
        .insert(changelogState)
        .values({ id: ROW_ID, lastPublishedSha: sha })
        .onConflictDoUpdate({
          target: changelogState.id,
          set: { lastPublishedSha: sha, publishedAt: sql`NOW()` },
        });
      return;
    } catch (err) {
      console.error(
        `[changelog] could not persist the published sha (attempt ${attempt}/${WRITE_ATTEMPTS}):`,
        err,
      );
      if (attempt < WRITE_ATTEMPTS) await sleep(attempt * 500);
    }
  }
  console.error(
    "[changelog] the published sha is unrecorded, so the next run will cover this batch again",
  );
}

/**
 * Stamp a run that completed with no commit to remember: a window that landed
 * none at all.
 *
 * Without it such a run stays overdue, so the catch-up would re-read the same
 * empty window every hour and then publish a one-line digest on whatever day
 * the next commit happened to land, which is the cadence it exists to protect.
 *
 * An UPDATE and not an upsert, because the row's sha is `NOT NULL` and a run
 * with no commits has none to write. Before the first publish ever there is
 * therefore nothing to stamp, and the state stays "never ran", which the
 * catch-up reads as overdue until a commit lands. That is the right answer, but
 * it is also indistinguishable from a write that did nothing, hence the line.
 */
export async function touchLastRun(): Promise<void> {
  const stamped = await db
    .update(changelogState)
    .set({ publishedAt: sql`NOW()` })
    .where(eq(changelogState.id, ROW_ID))
    .returning({ id: changelogState.id })
    .catch((err) => {
      console.error("[changelog] could not stamp the run:", err);
      return [];
    });
  if (stamped.length === 0) {
    console.warn("[changelog] no state row to stamp, the run stays overdue");
  }
}
