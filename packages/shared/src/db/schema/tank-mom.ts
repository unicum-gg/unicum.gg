import { integer, pgTable, timestamp } from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// One physical table per region (eu_tank_mom, na_tank_mom,
// asia_tank_mom). Unlike specs, the Mark of Mastery XP thresholds are
// server-specific: WG recomputes them per region as percentiles of per-battle
// XP (50% -> 3rd class, 80% -> 2nd, 95% -> 1st, 99% -> Ace), so a tank has
// three different sets of values. WG does not expose them via its public API;
// we mirror the poliroid aggregate daily so the page reads our DB, never a
// third party at request time (see mastery/poliroid.ts for the provider seam).
export function makeTankMomTable(region: string) {
  return pgTable(`${region}_tank_mom`, {
    tankId: integer("tank_id").primaryKey(),
    // XP required for each badge, from least to most demanding.
    class3: integer("class3").notNull(),
    class2: integer("class2").notNull(),
    class1: integer("class1").notNull(),
    ace: integer("ace").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type TankMomTable = ReturnType<typeof makeTankMomTable>;
export type TankMom = TankMomTable["$inferSelect"];
export type NewTankMom = TankMomTable["$inferInsert"];

export const momByRegion: Record<Region, TankMomTable> = {
  [Region.EU]: makeTankMomTable(Region.EU),
  [Region.NA]: makeTankMomTable(Region.NA),
  [Region.ASIA]: makeTankMomTable(Region.ASIA),
};
