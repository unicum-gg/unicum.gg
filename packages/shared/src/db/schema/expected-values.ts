import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Which rating's expected-values table a stored row holds.
 *
 * An enum rather than a free string for `changelog_state`'s reason: the set is
 * ours and closed, and a typo would not fail, it would silently open a second
 * row that no reader ever falls back to.
 */
export enum ExpectedValuesSource {
  /** XVM's per-tank table, from `static.modxvm.com`. */
  WN8 = "wn8",
  /** The WNX per-tank table (see `wn-expected` for its host). */
  WNX = "wnx",
}

/**
 * The last expected-values table we successfully read, per rating.
 *
 * These tables are read on the way to rendering any player page and they come
 * from third parties we do not run, so what happens when one is unreachable is
 * not an edge case, it is the whole reason this table exists: XVM's host went
 * down on 2026-10-14 (Cloudflare 521, their own origin refusing connections)
 * and every profile on the site answered 500 for as long as it was down.
 *
 * What is stored is deliberately OUR OWN last good read rather than a copy
 * committed to the repository. A committed table was the first fix written and
 * it was the wrong one: measured against the archive, every single one of the
 * 781 tanks common to two captures ten months apart had moved (median 0.37%,
 * p99 6.26%), so a file frozen at commit time is not a table that ages, it is
 * one that is wrong the next day and that nobody is ever reminded to refresh.
 * Reading it back from here instead means the fallback is whatever the origin
 * last served us, at most an hour old in normal operation and maintained by the
 * act of running.
 *
 * In Postgres rather than Redis, which is the mistake `changelog_state`
 * documents one file over: the instance runs `allkeys-lru` at its ceiling, a
 * key with no TTL is evicted like any other, and a value read only when an
 * origin is down is about the least recently used key in the store. Evicted, it
 * would be missing at precisely the moment it is needed.
 */
export const expectedValues = pgTable("expected_values", {
  /** An `ExpectedValuesSource`. Text rather than a pg enum: adding a rating
   * should be a constant, not a migration. */
  source: text("source").primaryKey(),
  /** The origin's response body, stored verbatim, so the reader parses what the
   * fetcher parses and a change in their shape cannot mean two things here. */
  payload: jsonb("payload").notNull(),
  /** When that read succeeded, which is what tells a reader how far behind the
   * table it is about to serve actually is. */
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
