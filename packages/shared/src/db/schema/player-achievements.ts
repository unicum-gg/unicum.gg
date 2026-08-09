import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import { playersByRegion, type PlayersTable } from "./players";

// One row per player: how many times they earned each Wargaming medal.
//
// A row per (player, medal) would be the textbook shape and the wrong one here:
// 2M players times ~126 earned medals is 260M rows to serve a grid that is
// always read whole, for one player at a time. The counts go in a single
// `jsonb` map instead — sparse (only what the player actually earned, never the
// 510-entry catalogue) and read in one indexed lookup.
//
// Overwritten rather than appended: this is current state, not history. The
// snapshot pipeline already skips writes for players whose counters did not
// move, so an inactive account is never rewritten.
export function makePlayerAchievementsTable(
  region: string,
  players: PlayersTable,
) {
  return pgTable(
    `${region}_player_achievements`,
    {
      playerId: integer("player_id")
        .primaryKey()
        .references(() => players.id, { onDelete: "cascade" }),
      // `{ medalKolobanov: 1, mainGun: 7649, … }`. Wargaming's own achievement
      // ids as keys, so nothing here has to track the catalogue.
      counts: jsonb("counts").notNull().$type<Record<string, number>>(),
      // Distinct medals earned, denormalised out of `counts`. Kept as a column
      // so "who has the most medals" and the rarity aggregates are an index
      // scan rather than a jsonb walk over every row.
      earned: integer("earned").notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      // Leaderboards by cabinet size, and the staleness sweep.
      index(`${region}_player_achievements_earned_idx`).on(t.earned),
      index(`${region}_player_achievements_updated_idx`).on(t.updatedAt),
    ],
  );
}

export type PlayerAchievementsTable = ReturnType<
  typeof makePlayerAchievementsTable
>;
export type PlayerAchievementsRow = PlayerAchievementsTable["$inferSelect"];
export type NewPlayerAchievementsRow = PlayerAchievementsTable["$inferInsert"];

export const playerAchievementsByRegion: Record<
  Region,
  PlayerAchievementsTable
> = {
  [Region.EU]: makePlayerAchievementsTable(Region.EU, playersByRegion[Region.EU]),
  [Region.NA]: makePlayerAchievementsTable(Region.NA, playersByRegion[Region.NA]),
  [Region.ASIA]: makePlayerAchievementsTable(
    Region.ASIA,
    playersByRegion[Region.ASIA],
  ),
};
