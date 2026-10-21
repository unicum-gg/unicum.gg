import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import { type PlayersTable, playersByRegion } from "./players";

/**
 * One player's record on one vehicle in one battle mode.
 *
 * `wot/tanks/stats/` has always answered a block per mode beside the `all` one,
 * and we stored only `all`, so the site could say what a player did on a tank
 * and never where. This is that breakdown.
 *
 * **It is current state, not a time series.** Every other per-tank table here
 * is keyed on a counter so a changed value inserts a new row, which is what
 * makes the profile's 24h/7d/30d columns possible. This one upserts in place,
 * and the reason is the size of what it sits beside: `eu_tank_snapshots` is 411
 * million rows and 101 GB, around 290 million distinct (player, vehicle) pairs,
 * and a quarter of those pairs carry at least one non-random mode. Keyed for
 * history this would be the second largest object in the database, to answer a
 * question nobody asked: the request was a breakdown, not a trend. Per-mode
 * periods would also need the history to exist BEFORE they could be computed,
 * so nothing is lost that a later migration could not start collecting.
 *
 * `random` has no row. It is `all` less `clan` and `company`, exactly (verified
 * across 797 vehicle rows and 18 counters, zero mismatches), so deriving it
 * keeps it from ever disagreeing with the overall figure every other surface on
 * the site already shows for that vehicle.
 *
 * A column is nullable when the mode it belongs to does not report it rather
 * than because of an organic backfill: Wargaming answers the armour figures for
 * `fallout`, `globalmap` and both Stronghold blocks and nothing else, and the
 * record scores for every mode except `company` and `globalmap`. See
 * `TankBattleMode`.
 */
export function makeTankModesTable(region: string, players: PlayersTable) {
  return pgTable(
    `${region}_tank_modes`,
    {
      playerId: integer("player_id")
        .notNull()
        .references(() => players.id, { onDelete: "cascade" }),
      tankId: integer("tank_id").notNull(),
      /** A `TankBattleMode`, which is Wargaming's own key for the block. */
      mode: text("mode").notNull(),
      /** When the fetch these counters came from landed. Carried per row rather
       * than per player: a mode a player stopped touching keeps the stamp of
       * the last call that still saw it move. */
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),

      battles: integer("battles").notNull(),
      wins: integer("wins").notNull(),
      losses: integer("losses").notNull(),
      draws: integer("draws").notNull(),
      survivedBattles: integer("survived_battles").notNull(),
      frags: integer("frags").notNull(),
      damageDealt: bigint("damage_dealt", { mode: "number" }).notNull(),
      damageReceived: bigint("damage_received", { mode: "number" }).notNull(),
      spotted: integer("spotted").notNull(),
      capturePoints: integer("capture_points").notNull(),
      droppedCapturePoints: integer("dropped_capture_points").notNull(),
      xp: bigint("xp", { mode: "number" }).notNull(),
      hits: integer("hits").notNull(),
      shots: integer("shots").notNull(),
      radioAssistedDamage: bigint("radio_assisted_damage", {
        mode: "number",
      }).notNull(),
      trackAssistedDamage: bigint("track_assisted_damage", {
        mode: "number",
      }).notNull(),
      stunNumber: integer("stun_number").notNull(),
      stunAssistedDamage: bigint("stun_assisted_damage", {
        mode: "number",
      }).notNull(),

      // Only `fallout`, `globalmap` and the two Stronghold blocks report these.
      piercings: integer("piercings"),
      // Cumulative, like the snapshot table's: Wargaming reports the per-battle
      // average, and a total is what sums and diffs.
      damageBlocked: bigint("damage_blocked", { mode: "number" }),
      // A ratio rather than a counter, so it neither sums nor diffs. Kept as
      // reported so the number on the page is the number in the client.
      tankingFactor: real("tanking_factor"),

      // The game's Record Score, per mode. `max_damage` is the line the top
      // level has no equivalent for and the one AGENTS.md records as having no
      // source: it is 0 for `random` and `clan` on every row measured, absent
      // from `company` and `globalmap`, and real everywhere else (2,142 of
      // 2,212 rows). Maxima, so they survive an aggregate as a max of maxima
      // and must never be diffed.
      maxDamage: integer("max_damage"),
      maxXp: integer("max_xp"),
      maxFrags: integer("max_frags"),
    },
    (t) => [
      // The garage table asks for one player's every vehicle in one mode, which
      // this takes straight to. The vehicle record asks for one (player, tank)
      // across every mode, which the primary key's own prefix already serves.
      index(`${region}_tank_modes_player_mode_idx`).on(t.playerId, t.mode),
      primaryKey({ columns: [t.playerId, t.tankId, t.mode] }),
    ],
  );
}

export type TankModesTable = ReturnType<typeof makeTankModesTable>;
export type TankModeRow = TankModesTable["$inferSelect"];
export type NewTankModeRow = TankModesTable["$inferInsert"];

export const tankModesByRegion: Record<Region, TankModesTable> = {
  [Region.EU]: makeTankModesTable(Region.EU, playersByRegion[Region.EU]),
  [Region.NA]: makeTankModesTable(Region.NA, playersByRegion[Region.NA]),
  [Region.ASIA]: makeTankModesTable(Region.ASIA, playersByRegion[Region.ASIA]),
};
