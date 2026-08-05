import { bigint, index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Region } from "@unicum.gg/wargaming";

/**
 * A player's previous nicknames. WG gives no rename history, so this only
 * accumulates going forward: a `BEFORE UPDATE` trigger on `${region}_players`
 * appends the *old* nickname here whenever a refresh writes a different one, so
 * `recorded_at` is when that name stopped being current.
 */
export function makePlayerNameHistoryTable(region: string) {
  return pgTable(
    `${region}_player_name_history`,
    {
      id: serial("id").primaryKey(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      nickname: text("nickname").notNull(),
      recordedAt: timestamp("recorded_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      index(`${region}_player_name_history_account_id_idx`).on(t.accountId),
      // Reverse lookup: which account used to carry this nickname. Backs the
      // redirect from a renamed player's old URL, and every miss on it (any
      // unknown nickname reaches this path) would otherwise scan the table.
      index(`${region}_player_name_history_nickname_lower_idx`).on(
        sql`LOWER(${t.nickname})`,
      ),
    ],
  );
}

export type PlayerNameHistoryTable = ReturnType<
  typeof makePlayerNameHistoryTable
>;
export type PlayerNameHistoryRow = PlayerNameHistoryTable["$inferSelect"];

export const playerNameHistoryByRegion: Record<Region, PlayerNameHistoryTable> =
  {
    [Region.EU]: makePlayerNameHistoryTable(Region.EU),
    [Region.NA]: makePlayerNameHistoryTable(Region.NA),
    [Region.ASIA]: makePlayerNameHistoryTable(Region.ASIA),
  };
