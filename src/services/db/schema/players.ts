import {
  bigint,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Region } from "@/services/wargaming/wot";

// One physical table per region (eu_players, na_players, asia_players).
// Callers index by region via `playersByRegion[region]`. No `region` column —
// the table name carries that info. We take region as `string` (not the
// `Region` enum) so the resulting table type uses `string` for tableName,
// keeping all 3 regions structurally identical — that way Drizzle's select
// inference treats `playersByRegion[region]` as a single type instead of a
// union of 3 distinct-named tables (which collapses fields to `never`).
export function makePlayersTable(region: string) {
  return pgTable(
    `${region}_players`,
    {
      id: serial("id").primaryKey(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      nickname: text("nickname").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }),
      lastBattleAt: timestamp("last_battle_at", { withTimezone: true }),
      clanId: bigint("clan_id", { mode: "number" }),
      firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [uniqueIndex(`${region}_players_account_id_idx`).on(t.accountId)],
  );
}

export type PlayersTable = ReturnType<typeof makePlayersTable>;
export type Player = PlayersTable["$inferSelect"];

export const playersByRegion: Record<Region, PlayersTable> = {
  [Region.EU]: makePlayersTable(Region.EU),
  [Region.NA]: makePlayersTable(Region.NA),
  [Region.ASIA]: makePlayersTable(Region.ASIA),
};
