import {
  bigint,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const clanDiscoveryQueue = pgTable(
  "clan_discovery_queue",
  {
    region: text("region").notNull(),
    clanId: bigint("clan_id", { mode: "number" }).notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.region, t.clanId] }),
    index("clan_discovery_queue_queued_at_idx").on(t.queuedAt),
  ],
);

export type ClanDiscoveryQueueRow = typeof clanDiscoveryQueue.$inferSelect;
