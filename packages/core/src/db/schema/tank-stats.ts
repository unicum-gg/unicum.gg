import {
  bigint,
  integer,
  numeric,
  pgTable,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming/region";

/**
 * Server-wide averages for a tank across every tracked player with a real
 * sample on it (>= the by-tank cron's MIN_BATTLES). Precomputed nightly in the
 * same streaming pass as the per-tank leaderboard. Powers the "server stats"
 * panel: how the average engaged player performs on the tank.
 */
export function makeTankStatsTable(region: string) {
  return pgTable(`${region}_tank_stats`, {
    tankId: bigint("tank_id", { mode: "number" }).primaryKey(),
    players: integer("players").notNull(),
    avgBattles: real("avg_battles").notNull(),
    // Total battles played on the tank across all qualifying players (the
    // "Games" column on the /tanks table). avgBattles is this / players.
    totalBattles: bigint("total_battles", { mode: "number" }),
    avgDamage: real("avg_damage").notNull(),
    winrate: real("winrate").notNull(),
    wn7: numeric("wn7"),
    wn8: numeric("wn8"),
    wnx: numeric("wnx"),
    // Extra server-average columns for the /tanks table. `playerWr`, `avgSpots`
    // and `avgAssist` come from data we already store, so they fill in on the
    // next cron run. `kdr`, `hitPct`, `penPct`, `avgBlocked` and `survival`
    // depend on tank_snapshots columns added at the same time, so they stay
    // null until enough players have been re-snapshotted (organic backfill).
    playerWr: real("player_wr"),
    avgSpots: real("avg_spots"),
    avgAssist: real("avg_assist"),
    kdr: real("kdr"),
    hitPct: real("hit_pct"),
    penPct: real("pen_pct"),
    avgBlocked: real("avg_blocked"),
    survival: real("survival"),
    // Cumulative holder counts among qualifying tracked players (>= the level):
    // moeN = players with at least N Marks of Excellence; momClassX = players who
    // reached at least that Mastery class (Ace implies all lower). Null until the
    // next cron run; MoE counts also grow as players get portal-refreshed.
    moe1: integer("moe_1"),
    moe2: integer("moe_2"),
    moe3: integer("moe_3"),
    momClass3: integer("mom_class3"),
    momClass2: integer("mom_class2"),
    momClass1: integer("mom_class1"),
    momAce: integer("mom_ace"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type TankStatsTable = ReturnType<typeof makeTankStatsTable>;

export const tankStatsByRegion: Record<Region, TankStatsTable> = {
  [Region.EU]: makeTankStatsTable(Region.EU),
  [Region.NA]: makeTankStatsTable(Region.NA),
  [Region.ASIA]: makeTankStatsTable(Region.ASIA),
};
