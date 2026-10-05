import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/** One vehicle's whole battle, as the client's own results report it. */
export type BattleVehicle = {
  /** Battle-scoped vehicle id, the key the client's own results are mapped by. */
  id: number;
  /** Wargaming account id, absent for a bot. */
  account?: number;
  team: number;
  /** `typeCompDescr`, the vehicle the account brought. */
  tank: number;
  damage: number;
  /** Assisted damage, split the way the game splits it. */
  radio: number;
  track: number;
  stun: number;
  blocked: number;
  received: number;
  shots: number;
  hits: number;
  piercings: number;
  spotted: number;
  kills: number;
  /** Seconds alive; the battle's duration when they survived it. */
  lifeTime: number;
  /** `-1` when they survived, otherwise the game's own reason code, where 0 is one. */
  deathReason: number;
  capturePoints: number;
  xp: number;
  credits: number;
  /** Hit points left, negative on the shot that overkills. */
  health: number;
  maxHealth: number;
  /**
   * The medals this battle awarded them, by the game's own ids.
   *
   * Absent rather than empty when there are none, which is the usual case:
   * measured over 6057 vehicle records, 28 carried any. Thirty empty arrays a
   * battle would be a slice of every payload saying nothing.
   */
  medals?: number[];

  // The rest of what the game's own post-battle panel shows about one player.
  // Every one of these is absent when it is zero, which is how most of them
  // are on most vehicles: thirty of them carrying ten zeroes each would be a
  // third of a battle spent saying nothing.

  /** Damage dealt from more than 300 metres, in the game's own wording. */
  sniper?: number;
  /** Shots that landed by splash rather than by hitting. */
  splash?: number;
  hitsReceived?: number;
  piercingsReceived?: number;
  /** Shots that landed and did nothing: the armour did its job. */
  bounced?: number;
  /** What would have landed had the armour not been there. */
  potential?: number;
  /** Hit points given back to allies. */
  repaired?: number;
  /** Metres driven. */
  mileage?: number;
  /** Capture points taken back off the other team. */
  defended?: number;
  teamDamage?: number;
  /** Enemy vehicles damaged, beside the ones destroyed. */
  damaged?: number;
  /** The battle-scoped vehicle id of whoever destroyed them. */
  killer?: number;
};

/**
 * What a battle earned one account: the reporting client's own economy.
 *
 * Every field is optional because the mod sends each only when it is non-zero,
 * which is how most of them are on most battles. The names are ours; the
 * mapping from the results' own (`originalCredits`, `autoLoadCost`...) lives
 * in the mod, beside the client that reads them.
 */
export type BattleEconomy = {
  /** Credits earned by the battle itself, before bonuses and before costs. */
  creditsBase?: number;
  /** Personal reserves. */
  creditsBooster?: number;
  creditsEvent?: number;
  creditsOrder?: number;
  /** Fine for damaging allies. */
  creditsPenalty?: number;
  /** Compensation for damage allies caused them. */
  creditsCompensation?: number;
  /** Everything earned, before the costs below. */
  creditsSubtotal?: number;
  repairCost?: number;
  /** The credits half of the ammunition bill; a gold resupply is deliberate. */
  ammoCost?: number;
  suppliesCost?: number;
  /** What actually landed in the account. */
  credits?: number;

  xpBase?: number;
  xpBooster?: number;
  xpEvent?: number;
  xpPremiumVehicle?: number;
  xpPenalty?: number;
  xp?: number;
  freeXp?: number;
  /** Crew experience. */
  crewXp?: number;

  bonds?: number;
  bondsBase?: number;

  /** Whether the account had premium when it played. */
  premium?: boolean;
};

/**
 * One row per battle, carrying all thirty vehicles.
 *
 * **A row per vehicle is the textbook shape and the wrong one here**, for the
 * same reason `player_achievements` is a jsonb map rather than a row per medal:
 * thirty vehicles a battle is 266M rows a year at a thousand active players,
 * against 8.9M for this. The detail is not dropped, it moves into `vehicles`.
 *
 * What that costs is the aggregate queries, and they were never going to run
 * off this table anyway: "average damage on this map in this tank" walks the
 * whole history and belongs in a cron-built aggregate, as `tier_winrate` and
 * `player_distribution` already are. What stays fast here is the lookup this
 * table exists for, "which battles was this account in", on the `player_ids`
 * GIN index.
 *
 * **The source is the client's battle results, not a .wotreplay.** Recording is
 * a player setting (`replayEnabled`, and new accounts do not get it at its
 * highest), so reading files would silently collect from a subset of players.
 * The results arrive in every client, for every battle, whatever that setting
 * says.
 *
 * **One battle reaches us from any participant, and names all thirty.** So
 * `arena_unique_id` is a deduplication key rather than an ownership one: two
 * players of ours in the same battle send the same row, and coverage grows by
 * whole teams rather than by one player at a time.
 *
 * Partitioned by month on `started_at` (see the migration, which drizzle-kit
 * cannot express). That is why the primary key leads with it: Postgres requires
 * the partition key inside every unique constraint. `started_at` is the
 * battle's own start, never our receipt, so the two senders of one battle land
 * on the same key in the same partition.
 */
export function makeBattlesTable(region: string) {
  return pgTable(
    `${region}_battles`,
    {
      /**
       * The game's own battle id, as text rather than the `bigint` the rest of
       * the schema uses for ids.
       *
       * It runs to 19 digits (2362123446407830031), past what a JSON number
       * survives, and it crosses the API and the SDK as JSON on every write and
       * every read. `bigint` in either drizzle mode loses it: `number` silently
       * rounds, `bigint` cannot be serialised at all. Nothing here does
       * arithmetic on it, only equality and deduplication, which text does
       * exactly as well.
       */
      arenaUniqueId: text("arena_unique_id").notNull(),
      startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
      /** `45_north_america`, the arena name rather than its display title. */
      mapName: text("map_name").notNull(),
      /** The game's own `bonusType`: 1 random, 43 onslaught, 20/21 skirmishes. */
      battleType: integer("battle_type").notNull(),
      /** `ctf`, `domination`, `assault`… */
      gameplayId: text("gameplay_id"),
      /** Seconds. */
      duration: integer("duration"),
      /** The team that won, 0 for a draw. */
      winnerTeam: integer("winner_team"),
      finishReason: integer("finish_reason"),
      /** The client that played it, which is what makes a replay playable. */
      clientVersion: text("client_version"),
      /**
       * The physical server, `EU-201`, off the battle results' own replayURL.
       *
       * Wargaming records every random battle server-side and hands the player
       * the path to their own; nothing public serves it, so this is kept for
       * the day something does, and because the cluster a battle ran on is a
       * fact nobody else collects.
       */
      server: text("server"),
      /**
       * Every account in the battle, bots excluded. Indexed, see above.
       *
       * `bigint`, like every other account id in this schema, and not because
       * of a hypothetical: measured on this database, 32394 of Asia's 254540
       * accounts are above int4's ceiling, the largest being 3021341123. This
       * column was `integer` in the first migration, which would have aborted
       * the insert of ~98% of Asia's battles and left the mod retrying them
       * for ever (see `drizzle/0121_battles_bigint_and_provenance.sql`).
       */
      playerIds: bigint("player_ids", { mode: "number" }).array().notNull(),
      vehicles: jsonb("vehicles").notNull().$type<BattleVehicle[]>(),
      /**
       * What this battle earned the client that reported it.
       *
       * Its own column rather than a field inside `vehicles`, because it is
       * neither a fact about a vehicle nor one about the battle: the results
       * carry it under `personal.<vehicle>`, for the reporting account alone,
       * and the other twenty-nine players have no economy in the payload at
       * any price. It belongs to the FIRST id in `reported_by`, the one whose
       * upload created the row; a second reporter adds their id and leaves
       * this alone, because it is not theirs to overwrite.
       *
       * Null for a battle recorded before the mod sent it.
       */
      personal: jsonb("personal").$type<BattleEconomy>(),
      /**
       * The accounts that told us about this battle. Appended, never replaced.
       *
       * A battle is a statement about thirty accounts and only the sender's is
       * proven. The endpoint checks the sender is among the players, which
       * bounds who must appear but not what is said about the other
       * twenty-nine. Without this column a fabricated battle could be neither
       * found nor withdrawn: nothing would answer "everything this account
       * reported". `tank_loadouts` gets that for free by being keyed on the
       * proven account; this table has to keep it deliberately.
       *
       * It is also the only honest measure of the multi-source coverage this
       * whole design rests on: a battle with two reporters was seen twice.
       */
      reportedBy: bigint("reported_by", { mode: "number" })
        .array()
        .notNull()
        .default([]),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      // Leads with the partition key, which Postgres requires of every unique
      // constraint on a partitioned table.
      primaryKey({ columns: [t.startedAt, t.arenaUniqueId] }),
      // "Which battles was this account in", the one lookup this table serves
      // directly. Everything else reads an aggregate.
      index(`${region}_battles_players_idx`).using("gin", t.playerIds),
      // The aggregate crons walk by time, and so does retention.
      index(`${region}_battles_started_idx`).on(t.startedAt),
      // Narrowing a sweep to one mode without reading the whole month.
      index(`${region}_battles_type_idx`).on(t.battleType, t.startedAt),
    ],
  );
}

export type BattlesTable = ReturnType<typeof makeBattlesTable>;
export type BattleRow = BattlesTable["$inferSelect"];
export type NewBattleRow = BattlesTable["$inferInsert"];

export const battlesByRegion: Record<Region, BattlesTable> = {
  [Region.EU]: makeBattlesTable(Region.EU),
  [Region.NA]: makeBattlesTable(Region.NA),
  [Region.ASIA]: makeBattlesTable(Region.ASIA),
};
