import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * How far the window refresh has caught up, per region: every account whose
 * snapshot aged past a window edge at or before `processed_until` has had its
 * window figures recomputed since.
 *
 * In Postgres rather than Redis for the reason `changelog_state` documents: the
 * instance evicts keys with no TTL like any other, and a lost mark here would
 * silently skip every crossing between it and the hour the next tick fell back
 * to. One row per region rather than a per-region table, since it is one fact
 * about each and nothing joins on it.
 */
export const windowRefreshState = pgTable("window_refresh_state", {
  /** A `Region`. */
  region: text("region").primaryKey(),
  processedUntil: timestamp("processed_until", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
