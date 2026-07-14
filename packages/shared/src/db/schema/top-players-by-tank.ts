import {
  bigint,
  integer,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * Per-tank leaderboard: the best players ON a given tank, precomputed nightly
 * from each player's latest tank_snapshot for that tank. One ranking per
 * (tank, metric), so (tank_id, metric, rank) is the natural primary key. The
 * displayed value (`value`) is the single-tank rating for the row's metric;
 * avg_damage / winrate are carried for a richer row without a second lookup.
 */
export function makeTopPlayersByTankTable(region: string) {
  return pgTable(
    `${region}_top_players_by_tank`,
    {
      tankId: bigint("tank_id", { mode: "number" }).notNull(),
      // 'wn7' | 'wn8' | 'wnx'
      metric: text("metric").notNull(),
      rank: integer("rank").notNull(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      nickname: text("nickname").notNull(),
      clanTag: text("clan_tag"),
      clanColor: text("clan_color"),
      battles: integer("battles").notNull(),
      avgDamage: real("avg_damage").notNull(),
      winrate: real("winrate").notNull(),
      value: numeric("value").notNull(),
      computedAt: timestamp("computed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.tankId, t.metric, t.rank] })],
  );
}

export type TopPlayersByTankTable = ReturnType<
  typeof makeTopPlayersByTankTable
>;

export const topPlayersByTankByRegion: Record<Region, TopPlayersByTankTable> = {
  [Region.EU]: makeTopPlayersByTankTable(Region.EU),
  [Region.NA]: makeTopPlayersByTankTable(Region.NA),
  [Region.ASIA]: makeTopPlayersByTankTable(Region.ASIA),
};
