import {
  bigint,
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Unified queue for clans the cron should fetch from WG. `firstSeen` is true
// for clans we've heard about but never fetched (discovery), false for known
// clans queued for periodic refresh. Cron drains by queued_at asc.
export const clanRefreshQueue = pgTable(
  "clan_refresh_queue",
  {
    region: text("region").notNull(),
    clanId: bigint("clan_id", { mode: "number" }).notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    firstSeen: boolean("first_seen").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.region, t.clanId] }),
    index("clan_refresh_queue_queued_at_idx").on(t.queuedAt),
  ],
);

export type ClanRefreshQueueRow = typeof clanRefreshQueue.$inferSelect;
