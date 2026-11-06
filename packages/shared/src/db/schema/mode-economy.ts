import {
  bigint,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import type { LoadoutMode } from "../../wot/loadout-stats";

/**
 * What each battle mode pays at each tier, over the recorded battles of the
 * trailing window: one row per (mode, tier), a few dozen per region.
 *
 * Rebuilt hourly from `*_battles` so no page ever walks it: the aggregate
 * unnests all thirty vehicles of every battle in the window, which is cheap
 * today and grows with every player who installs the mod. The counters are
 * stored and every ratio derived at read, like `*_tier_winrate`, so a row can
 * be re-summed rather than averaged.
 *
 * The `net_*` columns are the uploader's own economy (see `ModeEconomy`), a
 * separate and far smaller sample with its own counts.
 */
export function makeModeEconomyTable(region: string) {
  return pgTable(
    `${region}_mode_economy`,
    {
      mode: text("mode").$type<LoadoutMode>().notNull(),
      tier: smallint("tier").notNull(),
      windowDays: integer("window_days").notNull(),
      battles: integer("battles").notNull(),
      records: integer("records").notNull(),
      players: integer("players").notNull(),
      wins: integer("wins").notNull(),
      credits: bigint("credits", { mode: "number" }).notNull(),
      xp: bigint("xp", { mode: "number" }).notNull(),
      /** Battle length summed over the records, so per-minute figures are
       * weighted the same way as per-battle ones. */
      seconds: bigint("seconds", { mode: "number" }).notNull(),
      netRecords: integer("net_records").notNull(),
      netPlayers: integer("net_players").notNull(),
      netGross: bigint("net_gross", { mode: "number" }).notNull(),
      netCosts: bigint("net_costs", { mode: "number" }).notNull(),
      computedAt: timestamp("computed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.mode, t.tier] })],
  );
}

export type ModeEconomyTable = ReturnType<typeof makeModeEconomyTable>;

export const modeEconomyByRegion: Record<Region, ModeEconomyTable> = {
  [Region.EU]: makeModeEconomyTable(Region.EU),
  [Region.NA]: makeModeEconomyTable(Region.NA),
  [Region.ASIA]: makeModeEconomyTable(Region.ASIA),
};
