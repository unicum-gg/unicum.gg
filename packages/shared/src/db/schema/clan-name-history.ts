import { bigint, index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * A clan's previous tags + names. Like the player name history, it only
 * accumulates going forward: a `BEFORE UPDATE` trigger on `${region}_clans`
 * appends the *old* tag + name here whenever a refresh writes a different tag or
 * name, so `recorded_at` is when that pair stopped being current.
 */
export function makeClanNameHistoryTable(region: string) {
  return pgTable(
    `${region}_clan_name_history`,
    {
      id: serial("id").primaryKey(),
      clanId: bigint("clan_id", { mode: "number" }).notNull(),
      tag: text("tag").notNull(),
      name: text("name").notNull(),
      recordedAt: timestamp("recorded_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [index(`${region}_clan_name_history_clan_id_idx`).on(t.clanId)],
  );
}

export type ClanNameHistoryTable = ReturnType<typeof makeClanNameHistoryTable>;
export type ClanNameHistoryRow = ClanNameHistoryTable["$inferSelect"];

export const clanNameHistoryByRegion: Record<Region, ClanNameHistoryTable> = {
  [Region.EU]: makeClanNameHistoryTable(Region.EU),
  [Region.NA]: makeClanNameHistoryTable(Region.NA),
  [Region.ASIA]: makeClanNameHistoryTable(Region.ASIA),
};
