import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import { playersByRegion, type PlayersTable } from "./players";

// One row per player: how many times they earned each medal, on each of their
// vehicles. The game's per-tank "Awards" tab, for every tank at once.
//
// The grain is the player, not the (player, tank) pair, and that is the whole
// point of the table. Wargaming's `tanks/achievements` answers for a whole
// account in a single call, so a row per pair would explode one response into a
// couple of hundred rows (2M players times ~200 vehicles is 400M of them) to
// serve a panel that reads exactly one. The nesting keeps it at one row per
// player, written and read whole.
//
// Sparse on both levels: only vehicles that earned something, only medals that
// were earned. A player's map is a few kilobytes rather than the catalogue
// squared.
//
// Overwritten rather than appended: current state, not history. What a medal
// looked like a month ago is not a question anyone asks, and the vehicle's
// snapshot series already carries the counters that do move.
export function makePlayerTankAchievementsTable(
  region: string,
  players: PlayersTable,
) {
  return pgTable(
    `${region}_player_tank_achievements`,
    {
      playerId: integer("player_id")
        .primaryKey()
        .references(() => players.id, { onDelete: "cascade" }),
      // `{ "2929": { medalKolobanov: 1, mainGun: 113, … }, … }`. Wargaming's
      // own tank ids and achievement ids as keys, so nothing here tracks the
      // catalogue or the vehicle encyclopedia.
      counts: jsonb("counts")
        .notNull()
        .$type<Record<string, Record<string, number>>>(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    // Only the staleness sweep: nothing ranks players on this table, and the
    // panel always arrives with a player id.
    (t) => [
      index(`${region}_player_tank_achievements_updated_idx`).on(t.updatedAt),
    ],
  );
}

export type PlayerTankAchievementsTable = ReturnType<
  typeof makePlayerTankAchievementsTable
>;
export type PlayerTankAchievementsRow =
  PlayerTankAchievementsTable["$inferSelect"];

export const playerTankAchievementsByRegion: Record<
  Region,
  PlayerTankAchievementsTable
> = {
  [Region.EU]: makePlayerTankAchievementsTable(
    Region.EU,
    playersByRegion[Region.EU],
  ),
  [Region.NA]: makePlayerTankAchievementsTable(
    Region.NA,
    playersByRegion[Region.NA],
  ),
  [Region.ASIA]: makePlayerTankAchievementsTable(
    Region.ASIA,
    playersByRegion[Region.ASIA],
  ),
};
