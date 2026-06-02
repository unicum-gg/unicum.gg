import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// User-initiated and cron-initiated player refreshes queue. Snapshot cron
// drains this first, ordered by priority desc then queued_at asc, before
// falling back to its own oldest-snapshot scan. Higher priority = newer
// user visit; cron-discovered backfills sit at priority 0.
export const playerRefreshQueue = pgTable(
  "player_refresh_queue",
  {
    region: text("region").notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    priority: integer("priority").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.region, t.accountId] }),
    index("player_refresh_queue_priority_queued_at_idx").on(
      t.priority,
      t.queuedAt,
    ),
  ],
);

export type PlayerRefreshQueueRow = typeof playerRefreshQueue.$inferSelect;
