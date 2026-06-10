import {
  bigint,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Region } from "@/services/wargaming/wot";
import { type PlayersTable, playersByRegion } from "./players";

export function makeTankSnapshotsTable(
  region: string,
  players: PlayersTable,
) {
  return pgTable(
    `${region}_tank_snapshots`,
    {
      id: serial("id").primaryKey(),
      playerId: integer("player_id")
        .notNull()
        .references(() => players.id, { onDelete: "cascade" }),
      tankId: integer("tank_id").notNull(),
      takenAt: timestamp("taken_at", { withTimezone: true })
        .notNull()
        .defaultNow(),

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
      // Nullable because old snapshots predate these columns; backfill happens
      // organically as the snapshot cron writes new rows with the values from
      // WG's tanks/stats API.
      xp: bigint("xp", { mode: "number" }),
      markOfMastery: integer("mark_of_mastery"),
    },
    (t) => [
      index(`${region}_tank_snapshots_player_taken_idx`).on(
        t.playerId,
        t.takenAt,
      ),
      uniqueIndex(
        `${region}_tank_snapshots_player_tank_battles_unique_idx`,
      ).on(t.playerId, t.tankId, t.battles),
    ],
  );
}

export type TankSnapshotsTable = ReturnType<typeof makeTankSnapshotsTable>;
export type TankSnapshot = TankSnapshotsTable["$inferSelect"];
export type NewTankSnapshot = TankSnapshotsTable["$inferInsert"];

export const tankSnapshotsByRegion: Record<Region, TankSnapshotsTable> = {
  [Region.EU]: makeTankSnapshotsTable(Region.EU, playersByRegion[Region.EU]),
  [Region.NA]: makeTankSnapshotsTable(Region.NA, playersByRegion[Region.NA]),
  [Region.ASIA]: makeTankSnapshotsTable(
    Region.ASIA,
    playersByRegion[Region.ASIA],
  ),
};
