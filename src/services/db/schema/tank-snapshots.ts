import {
  bigint,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { players } from "./players";

export const tankSnapshots = pgTable(
  "tank_snapshots",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    tankId: integer("tank_id").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),

    battles: integer("battles").notNull(),
    wins: integer("wins").notNull(),
    damageDealt: bigint("damage_dealt", { mode: "number" }).notNull(),
    spotted: integer("spotted").notNull(),
    frags: integer("frags").notNull(),
    droppedCapturePoints: integer("dropped_capture_points").notNull(),
    radioAssistedDamage: bigint("radio_assisted_damage", {
      mode: "number",
    }).notNull(),
    trackAssistedDamage: bigint("track_assisted_damage", {
      mode: "number",
    }).notNull(),
  },
  (t) => [
    index("tank_snapshots_player_taken_idx").on(t.playerId, t.takenAt),
    uniqueIndex("tank_snapshots_player_tank_battles_unique_idx").on(
      t.playerId,
      t.tankId,
      t.battles,
    ),
  ],
);

export type TankSnapshot = typeof tankSnapshots.$inferSelect;
export type NewTankSnapshot = typeof tankSnapshots.$inferInsert;
