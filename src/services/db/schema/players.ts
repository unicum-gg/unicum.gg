import {
  bigint,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    region: text("region").notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    nickname: text("nickname").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("players_region_account_id_idx").on(t.region, t.accountId)],
);

export type Player = typeof players.$inferSelect;
