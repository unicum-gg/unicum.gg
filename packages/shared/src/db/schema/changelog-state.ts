import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Which product a stored marker belongs to.
 *
 * An enum rather than a free string because the set is ours and closed: a typo
 * in a product key does not fail, it silently opens a second marker that has
 * published nothing, and the next run then re-announces everything the channel
 * has already read.
 */
export enum ChangelogProduct {
  /** The site, written from its commit log by the model. */
  Web = "web",
  /** The client mod, taken from its published releases as written. */
  Mod = "mod",
}

/**
 * How far each product's changelog has been published.
 *
 * One row per product, keyed by it. It was a singleton row guarded by a check
 * constraint while the site was the only thing that announced anything, and the
 * mod is the second: its marker is a release tag where the site's is a commit
 * sha, which is why the column is a `ref` rather than a `sha`. Two tables would
 * have been two answers to one question ("what has this channel already been
 * told"), and the halves would drift the first time one of them learned
 * something the other did not.
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
export const changelogState = pgTable("changelog_state", {
  /** A `ChangelogProduct`. Text rather than a pg enum: adding a product should
   * be a constant, not a migration. */
  product: text("product").primaryKey(),
  /** How far that product was published: a full commit sha for the site, a
   * release tag (`v0.4.1`) for the mod. */
  lastPublishedRef: text("last_published_ref").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
