import {
  bigint,
  jsonb,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

export function makePlayerClanHistoryTable(region: string) {
  return pgTable(
    `${region}_player_clan_history`,
    {
      id: serial("id").primaryKey(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      fetchedAt: timestamp("fetched_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      data: jsonb("data").notNull(),
    },
    (t) => [
      uniqueIndex(`${region}_player_clan_history_account_id_idx`).on(
        t.accountId,
      ),
    ],
  );
}

export type PlayerClanHistoryTable = ReturnType<
  typeof makePlayerClanHistoryTable
>;
export type PlayerClanHistoryRow = PlayerClanHistoryTable["$inferSelect"];
export type NewPlayerClanHistoryRow = PlayerClanHistoryTable["$inferInsert"];

export const playerClanHistoryByRegion: Record<
  Region,
  PlayerClanHistoryTable
> = {
  [Region.EU]: makePlayerClanHistoryTable(Region.EU),
  [Region.NA]: makePlayerClanHistoryTable(Region.NA),
  [Region.ASIA]: makePlayerClanHistoryTable(Region.ASIA),
};
