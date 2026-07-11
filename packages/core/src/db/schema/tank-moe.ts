import { integer, pgTable, timestamp } from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming/region";

// One physical table per region (eu_tank_moe, na_tank_moe, asia_tank_moe). Like
// mastery, the Marks of Excellence thresholds are server-specific: WG recomputes
// them per region as percentiles of combined damage (65% -> 1 mark, 85% -> 2,
// 95% -> 3) over a rolling 14-day window, and they are not in the public WG API.
// We mirror the poliroid gunmarks aggregate daily so the page reads our DB, never
// a third party at request time (see moe/poliroid.ts for the provider seam).
export function makeTankMoeTable(region: string) {
  return pgTable(`${region}_tank_moe`, {
    tankId: integer("tank_id").primaryKey(),
    // Combined damage required for each mark (65th / 85th / 95th percentile).
    mark1: integer("mark1").notNull(),
    mark2: integer("mark2").notNull(),
    mark3: integer("mark3").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type TankMoeTable = ReturnType<typeof makeTankMoeTable>;
export type TankMoe = TankMoeTable["$inferSelect"];
export type NewTankMoe = TankMoeTable["$inferInsert"];

export const moeByRegion: Record<Region, TankMoeTable> = {
  [Region.EU]: makeTankMoeTable(Region.EU),
  [Region.NA]: makeTankMoeTable(Region.NA),
  [Region.ASIA]: makeTankMoeTable(Region.ASIA),
};
