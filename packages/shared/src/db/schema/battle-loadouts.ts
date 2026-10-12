import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import type { LoadoutCrewMember, LoadoutShell } from "../../wot/loadouts";

/**
 * What a player actually had fitted in one battle, for one life.
 *
 * `tank_loadouts` answers a different question and answers it well: what does
 * this account run on this tank today. Its own comment is explicit that a row
 * is REPLACED when a setup changes rather than appended to, which is right for
 * "what do they run" and useless for "what did they run in the battle where
 * they did four thousand damage". Measuring whether a device or a crew skill is
 * worth fitting needs the second question, so it needs rows that accumulate.
 *
 * **A table of its own rather than a column on `battles`.** Four reasons, each
 * sufficient on its own:
 *
 *  - the ingest upsert on `battles` updates `reported_by` and nothing else, on
 *    purpose, so a second reporter never overwrites the first's figures. A
 *    column added there would be written once and then never corrected, and it
 *    is sometimes the second reporter who holds the recording;
 *  - a respawn mode gives one loadout per LIFE, and several reporters give
 *    several players, so the natural key is (battle, vehicle, life), which is
 *    not the key of `battles`;
 *  - nesting it inside the `vehicles` document would mean rewriting ten to
 *    thirty kilobytes of JSON to add a fact of about one;
 *  - and every question asked of this is asked one tank at a time, so it wants
 *    an index on (tank, time). A row that carries thirty tanks cannot have one,
 *    and `battles` is indexed for the opposite question.
 *
 * **Partitioned exactly like `battles`**, monthly on `started_at`, because the
 * two are always read together and a join between tables partitioned
 * differently loses both pruning and the partition-wise join: a sweep over one
 * month would read the whole history instead.
 *
 * **The flat columns deliberately carry the same names as `tank_loadouts`.**
 * `opt_devices`, `consumables`, `boosters`, `crew_skills`, `premium_shell_share`
 * and `shells_loaded` mean there what they mean here, so one query can read
 * across both: what a population runs now, and what it ran then.
 *
 * **Rows are immutable.** There is no `updated_at` and nothing upserts the
 * contents. What someone fitted in a battle is not a thing that gets corrected
 * later; a row that disagrees with another is two sources disagreeing, which is
 * what `source` is for.
 */

/** Where a row came from, because the sources differ in what they can see. */
export const LOADOUT_SOURCE = {
  /**
   * Decoded from the `.wotreplay` the battle's own client recorded.
   *
   * Complete for the recording player: the devices, the directives, the
   * consumables, the rounds with their counts, and the crew with each seat's
   * skills. Only ever for that one player, because the server strips the
   * devices out of every other vehicle's public information before it reaches
   * any client.
   */
  replay: 1,
} as const;

export function makeBattleLoadoutsTable(region: string) {
  return pgTable(
    `${region}_battle_loadouts`,
    {
      // Leads the primary key because Postgres requires the partition key
      // inside every unique constraint on a partitioned table.
      startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
      /** Text for the same reason `battles` keeps it so: 19 digits. */
      arenaUniqueId: text("arena_unique_id").notNull(),
      /**
       * The battle-scoped vehicle id, which is also the replay's entity id.
       *
       * The same numbering, checked rather than assumed: a battle whose results
       * keyed its vehicles 539627196 to 539627209 produced a recording whose
       * entities ran over exactly that range. It is what joins a row here to
       * its entry in the battle's `vehicles` document.
       */
      vehicleId: bigint("vehicle_id", { mode: "number" }).notNull(),
      /**
       * Which life this is, counted from zero in the order they were played.
       *
       * Zero and nothing else outside a respawn mode. In the primary key
       * because without it a second life overwrites the first in silence, and
       * because an aggregate that treated two lives of one player as two
       * independent observations would count that player twice.
       */
      life: smallint("life").notNull(),

      /**
       * The account, where the battle names one.
       *
       * Null for a vehicle with no account, which is a bot, and bots are
       * reported by the game like anybody else.
       */
      accountId: bigint("account_id", { mode: "number" }),
      /**
       * `typeCompDescr` of the tank this life was played in.
       *
       * Null rather than guessed when it cannot be known for THIS life. The
       * tank comes from the battle's results, which name one vehicle per entry
       * and so name the LAST tank a respawning player drove; for a battle
       * without respawns that is the only tank and the value is exact, and for
       * one with respawns only the first life can be trusted to match. Writing
       * the final tank against every life would produce figures that look
       * right and attribute a loadout to the wrong vehicle, which is worse than
       * a gap. Filling it for every life needs the per-life vehicle read out of
       * the recording itself, which is the follow-up this column waits for.
       *
       * Every aggregate reads this, so every aggregate must exclude the nulls.
       */
      tankId: bigint("tank_id", { mode: "number" }),
      /**
       * The client that recorded it, which bounds what the figures compare.
       *
       * Equipment is rebalanced between patches, so two rows from different
       * builds are not two observations of the same thing.
       */
      clientVersion: text("client_version"),
      /** One of `LOADOUT_SOURCE`. */
      source: smallint("source").notNull(),

      /**
       * The optional devices fitted, BY SLOT, a free slot being a null in place.
       *
       * Positional here, unlike on `tank_loadouts`, which drops the empties
       * because it only ever answers containment. A device's category and its
       * grade depend on the slot it sits in, so closing the gaps would quietly
       * renumber everything after them.
       *
       * The element type is widened to admit null because that is what the
       * column really holds: Postgres has always allowed a null inside an
       * array, and drizzle's own type for `text().array()` is simply narrower
       * than the database. Declaring it is what keeps a free slot a free slot
       * rather than forcing a sentinel string that every reader would then
       * have to know about. The three positional columns do this; the two
       * containment columns below never hold a null and so do not.
       */
      optDevices: text("opt_devices").array().$type<(string | null)[]>(),
      /**
       * The same three devices, sorted and joined, as one value to group on.
       *
       * Because devices go in threes and are chosen as a set. "The rammer is
       * best" is really "the rammer with ventilation and a turbocharger": a
       * figure for one device alone is an average over every trio it appears
       * in, weighted by how popular those trios happen to be, so it moves when
       * fashion moves and not when the device changes. The trio is the unit
       * that can actually be measured; this column is what makes it groupable.
       */
      devicesTriple: text("devices_triple"),
      /** Directives, by slot. The client calls them battle boosters. */
      boosters: text("boosters").array().$type<(string | null)[]>(),
      /** Consumables, by slot. */
      consumables: text("consumables").array().$type<(string | null)[]>(),

      /**
       * Every skill on this crew, deduplicated, for containment queries.
       *
       * Here only so that this table and `tank_loadouts` can be asked the same
       * question. It cannot answer the question that matters, which is why the
       * column below exists.
       */
      crewSkills: text("crew_skills").array(),
      /**
       * Every skill with the seat that trained it, as `role:skill`.
       *
       * This is the column the whole table is for. A deduplicated list of skill
       * names cannot say which seat learned what, and for the five skills every
       * seat can learn -- repair, camouflage, brotherhood, armour patching and
       * firefighting -- HOW MANY of the crew trained it is the entire effect:
       * brotherhood only pays at five of five, and repair, camouflage and
       * firefighting are averaged across the crew. Deduplicating turns the one
       * thing being measured into a single boolean.
       */
      crewRoleSkills: text("crew_role_skills").array(),

      /**
       * What share of the rounds loaded cost gold, 0..1, or null for none.
       *
       * Derived on the way in, as on `tank_loadouts`, and for the same reason:
       * it is the figure every aggregate wants, and unpacking the rack on every
       * read to recompute it would be wasted work. Counted over rounds and not
       * over kinds of round, so two gold rounds beside forty standard ones is
       * not half.
       */
      premiumShellShare: real("premium_shell_share"),
      /** Rounds loaded in all, so the share above can be re-weighted. */
      shellsLoaded: integer("shells_loaded"),

      /**
       * The field modifications, packed exactly as the recording gives them.
       *
       * Raw rather than decoded, because decoding needs the vehicle's own
       * post-progression tree and a replay names a dozen vehicles that have
       * modifications; a dozen catalogue lookups do not belong on the request
       * a player is waiting on. The value is a handful of integers, it cannot
       * go stale, and whoever reads it holds those trees warm already.
       *
       * This is also why rows exist for vehicles with no loadout at all: a
       * replay carries the fitted loadout of one or two players and the field
       * modifications of everybody who has any.
       */
      fieldModsPacked: bigint("field_mods_packed", { mode: "number" }).array(),
      /** One entry per seat: its role and its skills, in order. */
      crew: jsonb("crew").$type<LoadoutCrewMember[]>(),
      /** The rounds loaded, each with its kind, its price and its count. */
      shells: jsonb("shells").$type<LoadoutShell[]>(),

      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({
        columns: [t.startedAt, t.arenaUniqueId, t.vehicleId, t.life],
      }),
      // The aggregate's own access path: one tank, over a window of time.
      index(`${region}_battle_loadouts_tank_idx`).on(t.tankId, t.startedAt),
      // "What did THIS player run on this tank, battle by battle", which is
      // the within-player contrast, and the only comparison here that is not
      // confounded by who chose the loadout.
      index(`${region}_battle_loadouts_account_idx`).on(
        t.accountId,
        t.tankId,
        t.startedAt,
      ),
      index(`${region}_battle_loadouts_devices_idx`).using("gin", t.optDevices),
      index(`${region}_battle_loadouts_skills_idx`).using(
        "gin",
        t.crewRoleSkills,
      ),
    ],
  );
}

export type BattleLoadoutsTable = ReturnType<typeof makeBattleLoadoutsTable>;
export type BattleLoadoutRow = BattleLoadoutsTable["$inferSelect"];
export type NewBattleLoadoutRow = BattleLoadoutsTable["$inferInsert"];

export const battleLoadoutsByRegion: Record<Region, BattleLoadoutsTable> = {
  [Region.EU]: makeBattleLoadoutsTable(Region.EU),
  [Region.NA]: makeBattleLoadoutsTable(Region.NA),
  [Region.ASIA]: makeBattleLoadoutsTable(Region.ASIA),
};
