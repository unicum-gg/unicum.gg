import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// One physical table per region (eu_vehicles, na_vehicles, asia_vehicles).
// Some servers (e.g. CN, future regions) ship tanks the others don't, so we
// keep the catalogue scoped per region rather than merging into a single
// global table. Refreshed weekly by the discovery cron; reads are <50ms
// instead of 5s+ wgFetch on cold start.
export function makeVehiclesTable(region: string) {
  return pgTable(`${region}_vehicles`, {
    tankId: integer("tank_id").primaryKey(),
    tier: integer("tier").notNull(),
    type: text("type").notNull(),
    nation: text("nation").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    tag: text("tag").notNull(),
    isPremium: boolean("is_premium").notNull(),
    isWheeled: boolean("is_wheeled").notNull(),
    isGift: boolean("is_gift").notNull(),
    // Reward / special vehicle (earned, not sold). Marked by the `special` tag;
    // these also carry a gold price, so check this before treating as premium.
    isReward: boolean("is_reward").notNull().default(false),
    // Raw WoT role token, e.g. `role_HT_assault`. Null for SPGs / roleless tanks.
    role: text("role"),
    // Present on the Common Test client but not on this region's live one: a
    // vehicle players can already inspect here weeks before it ships. Its
    // details are read from the CT branch of the mirror, not the region's.
    isCommonTest: boolean("is_common_test").notNull().default(false),
    smallIcon: text("small_icon"),
    contourIcon: text("contour_icon"),
    bigIcon: text("big_icon"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type VehiclesTable = ReturnType<typeof makeVehiclesTable>;
export type Vehicle = VehiclesTable["$inferSelect"];
export type NewVehicle = VehiclesTable["$inferInsert"];

export const vehiclesByRegion: Record<Region, VehiclesTable> = {
  [Region.EU]: makeVehiclesTable(Region.EU),
  [Region.NA]: makeVehiclesTable(Region.NA),
  [Region.ASIA]: makeVehiclesTable(Region.ASIA),
};
