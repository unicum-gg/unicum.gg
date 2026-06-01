import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const clanRecentEvents = pgTable(
  "clan_recent_events",
  {
    region: text("region").notNull(),
    clanId: bigint("clan_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    type: text("type").notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    accountName: text("account_name").notNull(),
    oldRole: text("old_role"),
    newRole: text("new_role"),
    oldRank: integer("old_rank"),
    newRank: integer("new_rank"),
  },
  (t) => [
    primaryKey({
      columns: [t.region, t.clanId, t.createdAt, t.type, t.accountId],
    }),
    index("clan_recent_events_clan_created_idx").on(
      t.region,
      t.clanId,
      t.createdAt,
    ),
  ],
);

export type ClanRecentEventRow = typeof clanRecentEvents.$inferSelect;
export type NewClanRecentEventRow = typeof clanRecentEvents.$inferInsert;
