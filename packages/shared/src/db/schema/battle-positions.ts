import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * Where players set up on a map and where they deal their damage from, read
 * out of the recorded battles.
 *
 * The question a player brings to a map is "I spawn here in this vehicle,
 * where do I go?". The battle's results say how everyone did and never where;
 * the positions are only in the `.wotreplay`, so they are read once when the
 * file arrives (a megabyte off the bucket plus a decryption per battle is not
 * something a page view can pay).
 *
 * **The recording player's team only.** A replay knows where every team mate
 * is at all times and an enemy only while somebody on that side has it
 * spotted. A sniper firing unseen is exactly the good position, and it is the
 * one an enemy's track would never show.
 *
 * Positions are percentages of the minimap, already projected into the box of
 * the layout the battle was played on (`projectPoint`), so they draw straight
 * over the image with the flags.
 */

/** The columns every row carries about the battle it comes from. */
function battleColumns() {
  return {
    /** Text for the same reason `battles` keeps it so: 19 digits. */
    arenaUniqueId: text("arena_unique_id").notNull(),
    /** The battle's own start, so a window can be applied without a join. */
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    /** The arena id (`04_himmelsdorf`), as `battles.map_name` carries it. */
    mapName: text("map_name").notNull(),
    /** The game's `bonusType`, which the modes are mapped from. */
    battleType: smallint("battle_type").notNull(),
    /**
     * The gameplay mode (`ctf`, `domination`, `assault`, `comp7`), which says
     * which layout of the arena the positions belong to: each has its own
     * spawns, and Onslaught its own smaller box.
     */
    gameplayId: text("gameplay_id").notNull(),
  };
}

/**
 * Where each vehicle of the recorder's team first set up after the opening
 * rush, and how its battle went.
 *
 * "Set up" is the first place it held for a while once the battle started (see
 * `SPOT_HOLD_SECONDS`): where a player decided to play from, which is the
 * decision a reader is trying to make. The outcome is the battle's own
 * results for that vehicle, so a spot can be read as "the players who went
 * here did this much".
 */
export function makeBattleSpotsTable(region: string) {
  return pgTable(
    `${region}_battle_spots`,
    {
      ...battleColumns(),
      /** The battle-scoped vehicle id, the results' and the replay's key. */
      vehicleId: bigint("vehicle_id", { mode: "number" }).notNull(),
      team: smallint("team").notNull(),
      tankId: integer("tank_id").notNull(),
      /** The client's class tag (`heavyTank`, `AT-SPG`, ...). */
      vehicleClass: text("vehicle_class").notNull(),
      /** When it settled there, in seconds of battle time. */
      settledAt: real("settled_at").notNull(),
      left: real("left").notNull(),
      top: real("top").notNull(),
      /** Its damage over the whole battle, from the results. */
      damage: integer("damage").notNull(),
      kills: smallint("kills").notNull(),
      survived: boolean("survived").notNull(),
      won: boolean("won").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.arenaUniqueId, t.vehicleId] }),
      index(`${region}_battle_spots_map_idx`).on(
        t.mapName,
        t.battleType,
        t.startedAt,
      ),
    ],
  );
}

/**
 * Every shot a vehicle of the recorder's team landed, placed where it was
 * fired from.
 *
 * The health packets carry each shot's author, so the damage is attributed to
 * the shot rather than spread over a battle: measured against the results, the
 * damage heard per vehicle matches to the hit point for as long as the
 * recording runs. Enemies hit while unseen by the recorder's side are not
 * heard, which is the same fog of war as everywhere else here.
 */
export function makeBattleHitsTable(region: string) {
  return pgTable(
    `${region}_battle_hits`,
    {
      ...battleColumns(),
      /** Seconds of battle time. */
      at: real("at").notNull(),
      victimId: bigint("victim_id", { mode: "number" }).notNull(),
      attackerId: bigint("attacker_id", { mode: "number" }).notNull(),
      team: smallint("team").notNull(),
      tankId: integer("tank_id").notNull(),
      vehicleClass: text("vehicle_class").notNull(),
      left: real("left").notNull(),
      top: real("top").notNull(),
      damage: integer("damage").notNull(),
      /** The shot that destroyed the victim. */
      fatal: boolean("fatal").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.arenaUniqueId, t.victimId, t.attackerId, t.at] }),
      index(`${region}_battle_hits_map_idx`).on(
        t.mapName,
        t.battleType,
        t.startedAt,
      ),
    ],
  );
}

export type BattleSpotsTable = ReturnType<typeof makeBattleSpotsTable>;
export type NewBattleSpotRow = BattleSpotsTable["$inferInsert"];
export type BattleHitsTable = ReturnType<typeof makeBattleHitsTable>;
export type NewBattleHitRow = BattleHitsTable["$inferInsert"];

export const battleSpotsByRegion: Record<Region, BattleSpotsTable> = {
  [Region.EU]: makeBattleSpotsTable(Region.EU),
  [Region.NA]: makeBattleSpotsTable(Region.NA),
  [Region.ASIA]: makeBattleSpotsTable(Region.ASIA),
};

export const battleHitsByRegion: Record<Region, BattleHitsTable> = {
  [Region.EU]: makeBattleHitsTable(Region.EU),
  [Region.NA]: makeBattleHitsTable(Region.NA),
  [Region.ASIA]: makeBattleHitsTable(Region.ASIA),
};
