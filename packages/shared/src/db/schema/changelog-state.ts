import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * How far the changelog has been published, as the last commit it covered.
 *
 * A singleton row, same shape as `cron_leader`: one global fact, guarded by a
 * check constraint so a second row cannot exist.
 *
 * This lived in Redis first, on the reasoning that one string surviving a
 * redeploy needs no schema. Redis does survive a redeploy — what it does not
 * survive is its own eviction policy. The instance runs `allkeys-lru` at its
 * memory ceiling, where a key without a TTL is evicted like any other, and this
 * one is read once a day, which makes it about the least recently used key in a
 * store shared with the ISR page cache. It was evicted between two runs, the
 * next run read nothing, fell back to its time window, and posted the previous
 * day's entries a second time.
 */
export const changelogState = pgTable(
  "changelog_state",
  {
    id: integer("id").primaryKey(),
    /** Full SHA of the last commit a published changelog covered. */
    lastPublishedSha: text("last_published_sha").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("changelog_state_singleton", sql`${t.id} = 1`)],
);
