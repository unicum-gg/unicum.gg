import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Refresh queue for clans. Mirrors player_refresh_queue: the refresh-cron
// drains by priority desc then queued_at asc. Higher priority = newer user
// page visit (priority 10); discovery-fed entries sit at priority 0.
export const clanRefreshQueue = pgTable(
  "clan_refresh_queue",
  {
    region: text("region").notNull(),
    clanId: bigint("clan_id", { mode: "number" }).notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    priority: integer("priority").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.region, t.clanId] }),
    index("clan_refresh_queue_priority_queued_at_idx").on(
      t.priority,
      t.queuedAt,
    ),
  ],
);

export type ClanRefreshQueueRow = typeof clanRefreshQueue.$inferSelect;
