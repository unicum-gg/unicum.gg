import {
  bigint,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const playerClanHistory = pgTable(
  "player_clan_history",
  {
    id: serial("id").primaryKey(),
    region: text("region").notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    data: jsonb("data").notNull(),
  },
  (t) => [
    uniqueIndex("player_clan_history_region_account_id_idx").on(
      t.region,
      t.accountId,
    ),
  ],
);

export type PlayerClanHistoryRow = typeof playerClanHistory.$inferSelect;
export type NewPlayerClanHistoryRow = typeof playerClanHistory.$inferInsert;
