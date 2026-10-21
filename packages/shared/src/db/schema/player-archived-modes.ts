import {
  bigint,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import { type PlayersTable, playersByRegion } from "./players";

/**
 * One account's record in a battle mode nobody can play any more.
 *
 * The five blocks `account/info` returns that the profile never read: Clan
 * Battles, Tank Company, Team Battles, Permanent Teams and Historical Battles.
 * See `PlayerArchivedMode`.
 *
 * **A row per player, not a column set on every snapshot**, which is where the
 * eight live modes live. The reason is the one thing these five have in common:
 * their totals are finished. `*_player_snapshots` is 111 columns, 23 million
 * rows and 14 GB on EU, and it exists to be DIFFED, which is what gives the
 * live modes their 24h/7d/30d columns. Fifty-five more columns there would add
 * around 7 GB to repeat a number that never moves again, so that the periods
 * computed from them could come out zero every time. Here the same data is a
 * couple of million narrow rows, and only for the accounts that actually played
 * these modes.
 *
 * The consequence is deliberate and visible: a mode here has a total and no
 * periods. That is not a gap waiting to be filled, it is what a finished record
 * looks like.
 *
 * The counters mirror `StrongholdStats`, the shape every mode panel on the
 * profile already renders, so the same table draws these with no second
 * component.
 */
export function makePlayerArchivedModesTable(
  region: string,
  players: PlayersTable,
) {
  return pgTable(
    `${region}_player_archived_modes`,
    {
      playerId: integer("player_id")
        .notNull()
        .references(() => players.id, { onDelete: "cascade" }),
      /** A `PlayerArchivedMode`, which is Wargaming's own name for the block. */
      mode: text("mode").notNull(),
      /** When the call these counters came from landed. They should never move
       * again, so a stamp that does is worth noticing. */
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
      spotted: integer("spotted").notNull(),
      capturePoints: integer("capture_points").notNull(),
      droppedCapturePoints: integer("dropped_capture_points").notNull(),
      battleAvgXp: integer("battle_avg_xp").notNull(),
    },
    (t) => [primaryKey({ columns: [t.playerId, t.mode] })],
  );
}

export type PlayerArchivedModesTable = ReturnType<
  typeof makePlayerArchivedModesTable
>;
export type PlayerArchivedModeRow = PlayerArchivedModesTable["$inferSelect"];
export type NewPlayerArchivedModeRow =
  PlayerArchivedModesTable["$inferInsert"];

export const playerArchivedModesByRegion: Record<
  Region,
  PlayerArchivedModesTable
> = {
  [Region.EU]: makePlayerArchivedModesTable(
    Region.EU,
    playersByRegion[Region.EU],
  ),
  [Region.NA]: makePlayerArchivedModesTable(
    Region.NA,
    playersByRegion[Region.NA],
  ),
  [Region.ASIA]: makePlayerArchivedModesTable(
    Region.ASIA,
    playersByRegion[Region.ASIA],
  ),
};
