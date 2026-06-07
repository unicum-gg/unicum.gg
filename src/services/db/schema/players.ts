import {
  bigint,
  integer,
  pgTable,
  real,
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
      // Cached ratings — updated by the snapshot-cron whenever a new tank
      // snapshot is recorded. Lets the player page render synchronously and
      // the clan page JOIN for member ratings without per-request compute.
      // `wnx30d` + `battles30d` cover a 30-day window so they line up with
      // the player page "Last 30d" column; the clan aggregate weights
      // members by `battles30d` for a consistent recent view.
      wn7: real("wn7"),
      wn8: real("wn8"),
      wnx: real("wnx"),
      wn730d: real("wn7_30d"),
      wn830d: real("wn8_30d"),
      wnx30d: real("wnx_30d"),
      // Lifetime battle count, copied from the latest snapshot's `battles`
      // field at every snapshot-cron tick. Lets the Overall top-players
      // ranking apply the 20k-battle minimum without DISTINCT-ON-scanning
      // the whole player_snapshots table.
      battles: integer("battles"),
      battles30d: integer("battles_30d"),
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
