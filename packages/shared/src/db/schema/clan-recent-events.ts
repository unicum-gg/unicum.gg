import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

export function makeClanRecentEventsTable(region: string) {
  return pgTable(
    `${region}_clan_recent_events`,
    {
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
        columns: [t.clanId, t.createdAt, t.type, t.accountId],
      }),
      index(`${region}_clan_recent_events_clan_created_idx`).on(
        t.clanId,
        t.createdAt,
      ),
    ],
  );
}

export type ClanRecentEventsTable = ReturnType<
  typeof makeClanRecentEventsTable
>;
export type ClanRecentEventRow = ClanRecentEventsTable["$inferSelect"];
export type NewClanRecentEventRow = ClanRecentEventsTable["$inferInsert"];

export const clanRecentEventsByRegion: Record<Region, ClanRecentEventsTable> = {
  [Region.EU]: makeClanRecentEventsTable(Region.EU),
  [Region.NA]: makeClanRecentEventsTable(Region.NA),
  [Region.ASIA]: makeClanRecentEventsTable(Region.ASIA),
};
