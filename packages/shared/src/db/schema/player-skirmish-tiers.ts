import {
  bigint,
  integer,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import { type PlayersTable, playersByRegion } from "./players";

/**
 * A player's Skirmish totals at one tier, each time they moved.
 *
 * `*_tank_modes` is current state on purpose (see `makeTankModesTable`), so on
 * its own it gives the per-tier split a lifetime figure and nothing to diff.
 * This is the one history that split needs, kept at the grain it is read at:
 * per (player, tier) rather than per vehicle, and a row only when that tier's
 * battle count changed, so a player who never plays a skirmish adds nothing and
 * one who does adds at most a row per refresh that saw them play it.
 *
 * `tier` 0 holds the battles on vehicles of any other tier (the formats
 * Skirmishes had before they were fought at one tier), since a primary key
 * column cannot be null. The history starts when this table did: there is no
 * earlier state of `*_tank_modes` to recover it from.
 */
export function makePlayerSkirmishTiersTable(
  region: string,
  players: PlayersTable,
) {
  return pgTable(
    `${region}_player_skirmish_tiers`,
    {
      playerId: integer("player_id")
        .notNull()
        .references(() => players.id, { onDelete: "cascade" }),
      tier: smallint("tier").notNull(),
      takenAt: timestamp("taken_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      battles: integer("battles").notNull(),
      wins: integer("wins").notNull(),
      losses: integer("losses").notNull(),
      draws: integer("draws").notNull(),
      survivedBattles: integer("survived_battles").notNull(),
      frags: integer("frags").notNull(),
      damageDealt: bigint("damage_dealt", { mode: "number" }).notNull(),
      spotted: integer("spotted").notNull(),
      capturePoints: integer("capture_points").notNull(),
      droppedCapturePoints: integer("dropped_capture_points").notNull(),
      xp: bigint("xp", { mode: "number" }).notNull(),
    },
    // The read asks for one player's newest row per tier at or before an
    // instant, which the key's own order answers.
    (t) => [primaryKey({ columns: [t.playerId, t.tier, t.takenAt] })],
  );
}

export type PlayerSkirmishTiersTable = ReturnType<
  typeof makePlayerSkirmishTiersTable
>;

export const playerSkirmishTiersByRegion: Record<
  Region,
  PlayerSkirmishTiersTable
> = {
  [Region.EU]: makePlayerSkirmishTiersTable(
    Region.EU,
    playersByRegion[Region.EU],
  ),
  [Region.NA]: makePlayerSkirmishTiersTable(
    Region.NA,
    playersByRegion[Region.NA],
  ),
  [Region.ASIA]: makePlayerSkirmishTiersTable(
    Region.ASIA,
    playersByRegion[Region.ASIA],
  ),
};
