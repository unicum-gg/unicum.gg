import {
  bigint,
  index,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Tank characteristics change history, patch by patch. WG balances vehicles
 * identically across servers, so like `tank_specs` these are **global** (one
 * row per tank_id, not per region), stamped with the game version the change
 * landed in.
 *
 * Wargaming keeps no public archive of past client versions, so this history
 * cannot be reconstructed after the fact: it is built forward, by snapshotting
 * the specs at every game-version bump and diffing against the previous
 * snapshot (see `packages/core/.../tanks/spec-history.ts`). The mirror's git
 * history could seed the past in a later backfill, but the two tables below are
 * the durable store either way.
 */

/**
 * The baseline spec of a tank at a given game version, the point the next
 * version is diffed against. `data` holds the tracked numeric fields (see
 * `TRACKED_SPEC_FIELDS`) at their raw stored scale.
 *
 * Immutable per version: only the FIRST spec seen for a `(tank_id, game_version)`
 * is kept, so a mid-patch mirror correction never masquerades as a balance
 * change. The diff at the next version compares that frozen baseline to the new
 * one.
 */
export const tankSpecSnapshots = pgTable(
  "tank_spec_snapshots",
  {
    tankId: bigint("tank_id", { mode: "number" }).notNull(),
    gameVersion: text("game_version").notNull(),
    data: jsonb("data").$type<Record<string, number>>().notNull(),
    // The vehicle's wot-src tag (e.g. `G188_LeKpz_Borkenkafer`). The compact
    // `tank_id` is a slot id WG reuses: a removed bot/bootcamp/event vehicle's id
    // is later handed to a brand-new tank. The tag is the stable identity, so a
    // change of tag at the same id is a NEW tank (a fresh baseline + release),
    // never a diff across two unrelated vehicles.
    tag: text("tag"),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tankId, t.gameVersion] }),
    // Latest snapshot per tank is read on every refresh (DISTINCT ON tank_id
    // ORDER BY captured_at DESC).
    index("tank_spec_snapshots_tank_idx").on(t.tankId, t.capturedAt),
  ],
);

/**
 * One recorded change to a single spec field at a game-version bump. `previous`
 * and `next` are the raw stored values (the UI applies the field's scale and
 * formatting); either is null when the field appeared or disappeared. Buff vs
 * nerf is not stored: the reader derives it from the field's direction
 * (`TRACKED_SPEC_FIELDS`), so it stays correct if we ever reclassify one.
 */
export const tankChanges = pgTable(
  "tank_changes",
  {
    id: serial("id").primaryKey(),
    tankId: bigint("tank_id", { mode: "number" }).notNull(),
    gameVersion: text("game_version").notNull(),
    field: text("field").notNull(),
    previous: real("previous"),
    next: real("next"),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Per-tank history (the tank page's History tab).
    index("tank_changes_tank_idx").on(t.tankId, t.capturedAt),
    // The global feed, newest first.
    index("tank_changes_captured_idx").on(t.capturedAt),
  ],
);

/**
 * What the Common Test client changes about a vehicle the live one already has,
 * global and keyed by tank_id: `previous` is the live value, `next` the test
 * one. This is what the test build is for from a player's point of view, and it
 * exists nowhere in Wargaming's API.
 *
 * Rewritten wholesale on every catalogue refresh rather than appended to: a
 * test build is a moving target that gets rebalanced mid-test and vanishes when
 * it ships, so only its current state is meaningful. `tank_changes` is the
 * opposite, an append-only record of what actually shipped.
 */
export const tankTestChanges = pgTable(
  "tank_test_changes",
  {
    id: serial("id").primaryKey(),
    tankId: bigint("tank_id", { mode: "number" }).notNull(),
    /** The test build these values were read from, e.g. `2.4.0.5415`. */
    testVersion: text("test_version").notNull(),
    field: text("field").notNull(),
    previous: real("previous"),
    next: real("next"),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("tank_test_changes_tank_idx").on(t.tankId)],
);

export type TankTestChange = typeof tankTestChanges.$inferSelect;
export type NewTankTestChange = typeof tankTestChanges.$inferInsert;

/**
 * Per-tank lifecycle, global, keyed by tank_id. `releasedVersion`/`releasedAt`
 * is when the tank first appeared as a real (non-bot) vehicle; null when that
 * predates our tracking window. Populated by the spec-history backfill and
 * forward cron, keyed on the vehicle **tag** so a reused slot id credits the new
 * tank, not the removed one.
 *
 * `devVersion`/`devAt` (a pre-release dev-stub sighting) is retained for
 * backward compatibility but no longer populated: the `isReleasedSpec` dispersion
 * heuristic effectively never fired on a genuine tank (its only hits were event
 * clones), so the "in development" phase was dropped.
 */
export const tankIntroductions = pgTable("tank_introductions", {
  tankId: bigint("tank_id", { mode: "number" }).primaryKey(),
  devVersion: text("dev_version"),
  devAt: timestamp("dev_at", { withTimezone: true }),
  releasedVersion: text("released_version"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TankIntroduction = typeof tankIntroductions.$inferSelect;
export type NewTankIntroduction = typeof tankIntroductions.$inferInsert;

export type TankSpecSnapshot = typeof tankSpecSnapshots.$inferSelect;
export type NewTankSpecSnapshot = typeof tankSpecSnapshots.$inferInsert;
export type TankChange = typeof tankChanges.$inferSelect;
export type NewTankChange = typeof tankChanges.$inferInsert;
