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
import type { BattleEconomy } from "./battles";

/**
 * What the recorder did to one enemy, as their own results tell it: the
 * game's "battle performance" row. Read from the file, since only the
 * recording client's results carry it.
 */
export type BattleEnemyDetail = {
  /** The enemy's battle-scoped vehicle id, keyed like the battle's rows. */
  vehicle: number;
  spotted: boolean;
  /** Assisted damage on this enemy: by spotting, tracking and stunning. */
  assisted: number;
  /** Whether the recorder damaged a module or a crew member of it. */
  crits: boolean;
  damageDealt: number;
  directHits: number;
  piercings: number;
  killed: boolean;
  /** Damage their armour blocked from this enemy, and the hits it bounced. */
  blocked?: number;
  blockedHits?: number;
  /** Times they stunned it. */
  stuns?: number;
};

/**
 * One archived `.wotreplay`, per recorder.
 *
 * A battle can have several: every participant who runs the mod records their
 * own, and each is a different point of view, since a replay holds what the
 * server sent THAT client, with its own camera and aim. So the file is keyed
 * on the battle and its recorder, never on the battle alone.
 *
 * Global rather than per region like the comments: a row is addressed by its
 * region and battle together, and replays are far too few for three tables.
 */
export const battleReplays = pgTable(
  "battle_replays",
  {
    region: text("region").notNull(),
    arenaUniqueId: text("arena_unique_id").notNull(),
    /** The battle's partition key, to reach its row without a scan. */
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    /** Whose recording it is: the `playerID` in the file's own header. */
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    /** The object in the bucket. */
    key: text("key").notNull(),
    storedAt: timestamp("stored_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** The recorder's own economy, from their results in the file. */
    personal: jsonb("personal").$type<BattleEconomy | null>(),
    /** The recorder's "battle performance" against each enemy. */
    details: jsonb("details").$type<BattleEnemyDetail[] | null>(),
    /** The game's mastery badge this battle earned, 0 for none. */
    markOfMastery: integer("mark_of_mastery"),
    /** Readers who opened this replay's page. */
    views: integer("views").notNull().default(0),
    /** Times the file was downloaded. */
    downloads: integer("downloads").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.region, t.arenaUniqueId, t.accountId] }),
    index("battle_replays_recorder_idx").on(t.region, t.accountId),
    index("battle_replays_started_idx").on(t.region, t.startedAt),
  ],
);

export type BattleReplayRow = typeof battleReplays.$inferSelect;
