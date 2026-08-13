import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import { type PlayersTable, playersByRegion } from "./players";

export function makeTankSnapshotsTable(
  region: string,
  players: PlayersTable,
) {
  return pgTable(
    `${region}_tank_snapshots`,
    {
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
      // Marks of Excellence on the gun (0-3). Sourced from the WoT portal
      // (`/wotup/profile/vehicles/list/`), not the public API, so it is only set
      // on refreshes that reach the portal; nullable + organically backfilled.
      marksOnGun: integer("marks_on_gun"),
      // Added later for the per-tank server-average table (KDR, Hit%, Pen%,
      // Blocked, Survival). Nullable + organically backfilled, same as xp above.
      // `damageBlocked` is a cumulative total: WG only exposes the per-battle
      // average, so we store average * battles to match the other counters.
      survivedBattles: integer("survived_battles"),
      hits: integer("hits"),
      shots: integer("shots"),
      piercings: integer("piercings"),
      damageBlocked: bigint("damage_blocked", { mode: "number" }),
      // The rest of the in-game vehicle record (Service Record → Statistics),
      // so a player's page can show what the game shows for that tank. Same
      // deal as above: nullable, organically backfilled, and free to fetch
      // since they ride the `tanks/stats` call we already make.
      damageReceived: bigint("damage_received", { mode: "number" }),
      capturePoints: integer("capture_points"),
      stunNumber: integer("stun_number"),
      stunAssistedDamage: bigint("stun_assisted_damage", { mode: "number" }),
      // Wargaming's "armor use efficiency", the one value here that is a ratio
      // rather than a counter: it cannot be summed across tanks or diffed
      // between two snapshots, only read as-is for the tank it belongs to.
      // Kept from the API rather than derived from blocked/received so the
      // number on the page is the number in the client.
      tankingFactor: real("tanking_factor"),
      // The game's "Record Score": the best single battle on this tank. Maxima,
      // so like `tanking_factor` they must never be diffed between snapshots;
      // unlike it they do survive an aggregate, as a max of maxima. Wargaming
      // exposes no per-tank maximum damage, so that line of the game's block
      // has no column here.
      maxXp: integer("max_xp"),
      maxFrags: integer("max_frags"),
    },
    (t) => [
      index(`${region}_tank_snapshots_player_taken_idx`).on(
        t.playerId,
        t.takenAt,
      ),
      // (player, tank, battles) IS the identity of a row: the same counter state
      // for the same tank is the same observation. A surrogate `serial` id used
      // to carry the primary key, but it bought nothing (nothing referenced it,
      // it only broke ties between rows sharing a `taken_at`) and its 4-byte
      // counter ran out on EU at 2.1B rows, which stopped every tank write dead
      // (migration 0061). The natural key has no ceiling.
      primaryKey({ columns: [t.playerId, t.tankId, t.battles] }),
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
