import {
  bigint,
  index,
  integer,
  pgTable,
  real,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { players } from "./players";

export const playerSnapshots = pgTable(
  "player_snapshots",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),

    battles: integer("battles").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    draws: integer("draws").notNull(),
    survivedBattles: integer("survived_battles").notNull(),
    frags: integer("frags").notNull(),
    damageDealt: bigint("damage_dealt", { mode: "number" }).notNull(),
    damageReceived: bigint("damage_received", { mode: "number" }).notNull(),
    xp: bigint("xp", { mode: "number" }).notNull(),
    battleAvgXp: integer("battle_avg_xp").notNull(),
    spotted: integer("spotted").notNull(),
    capturePoints: integer("capture_points").notNull(),
    droppedCapturePoints: integer("dropped_capture_points").notNull(),
    hits: integer("hits").notNull(),
    shots: integer("shots").notNull(),
    hitsPercents: real("hits_percents").notNull(),
    globalRating: integer("global_rating").notNull(),
  },
  (t) => [
    index("snapshots_player_id_taken_at_idx").on(t.playerId, t.takenAt),
    uniqueIndex("snapshots_player_id_battles_unique_idx").on(
      t.playerId,
      t.battles,
    ),
  ],
);

export type PlayerSnapshot = typeof playerSnapshots.$inferSelect;
export type NewPlayerSnapshot = typeof playerSnapshots.$inferInsert;
