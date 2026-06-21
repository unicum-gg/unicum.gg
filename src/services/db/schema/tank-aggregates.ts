import {
  bigint,
  integer,
  pgTable,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@/services/wargaming/wot";

// One physical table per region (eu_tank_aggregates, na_tank_aggregates,
// asia_tank_aggregates). One row per tank, holding the community totals
// rolled up from every tracked player's latest per-tank snapshot.
//
// Why a precomputed table rather than aggregating on the fly: the per-tank
// page would otherwise scan millions of `<region>_tank_snapshots` rows on
// every request (DISTINCT ON latest-per-player then GROUP BY), which both
// blows the CWV budget and the contribution margin. The aggregate cron
// recomputes this nightly; the page then reads a single row (<5ms) so the
// marginal cost of a tank pageview stays near zero.
//
// We store raw sums plus a player count and derive the averages in the app
// so the precision policy lives in one place and we can change it without a
// migration. `players` is the number of tracked players with battles > 0 on
// the tank (popularity), used both for ordering the index and as a
// confidence signal next to the averages.
export function makeTankAggregatesTable(region: string) {
  return pgTable(`${region}_tank_aggregates`, {
    tankId: integer("tank_id").primaryKey(),
    players: integer("players").notNull(),
    battles: bigint("battles", { mode: "number" }).notNull(),
    wins: bigint("wins", { mode: "number" }).notNull(),
    damageDealt: bigint("damage_dealt", { mode: "number" }).notNull(),
    frags: bigint("frags", { mode: "number" }).notNull(),
    spotted: bigint("spotted", { mode: "number" }).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type TankAggregatesTable = ReturnType<typeof makeTankAggregatesTable>;
export type TankAggregate = TankAggregatesTable["$inferSelect"];
export type NewTankAggregate = TankAggregatesTable["$inferInsert"];

export const tankAggregatesByRegion: Record<Region, TankAggregatesTable> = {
  [Region.EU]: makeTankAggregatesTable(Region.EU),
  [Region.NA]: makeTankAggregatesTable(Region.NA),
  [Region.ASIA]: makeTankAggregatesTable(Region.ASIA),
};
