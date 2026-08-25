import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { MapSnapshotData } from "../../wot/maps/history-snapshot";

/**
 * How the game's maps change from one version to the next: play areas resized,
 * game modes gained or lost, bases and spawns moved, maps added to and pulled
 * from the client.
 *
 * Global like the tank history (Wargaming ships the same maps to every server),
 * and built from the same two directions: the wot-src mirror's git history seeds
 * the past, the catalogue refresh accrues the future. See
 * `packages/core/.../maps/history.ts`.
 *
 * Maps carry no numeric characteristics the way vehicles do, so `previous` and
 * `next` are text: a number, a camouflage token, a presence sentinel, or a
 * serialized marker list the minimap overlay reads back.
 */

/**
 * A map's tracked state at a game version, the point the next version is diffed
 * against. Immutable per version: only the first state seen for an
 * `(arena_id, game_version)` is kept, so a mid-patch mirror correction never
 * reads as a rework.
 */
export const mapSnapshots = pgTable(
  "map_snapshots",
  {
    arenaId: text("arena_id").notNull(),
    gameVersion: text("game_version").notNull(),
    data: jsonb("data").$type<MapSnapshotData>().notNull(),
    /** The map's display name at that version. Arena ids are re-used (the Grand
     * Battle arena `212_epic_random_valley_sm25` came back as Nebelburg), so the
     * name is what tells a rework from a different map at the same id. */
    name: text("name").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.arenaId, t.gameVersion] }),
    index("map_snapshots_arena_idx").on(t.arenaId, t.capturedAt),
  ],
);

/**
 * One recorded change to a map at a game-version bump. `field` is a tracked
 * scalar (`roundLength`), a mode or battle type the map gained or lost
 * (`mode:standard`), a marker group (`geometry:ctf:bases:team1`), or the map
 * entering/leaving the game (`presence`). Either side is null when the property
 * did not exist then.
 */
export const mapChanges = pgTable(
  "map_changes",
  {
    id: serial("id").primaryKey(),
    arenaId: text("arena_id").notNull(),
    gameVersion: text("game_version").notNull(),
    field: text("field").notNull(),
    previous: text("previous"),
    next: text("next"),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Per-map history (the map page's History tab).
    index("map_changes_arena_idx").on(t.arenaId, t.capturedAt),
    // The global feed, newest first.
    index("map_changes_captured_idx").on(t.capturedAt),
  ],
);

/**
 * What the Common Test client changes about the maps the live one already has:
 * `previous` is the live value, `next` the test one.
 *
 * Rewritten wholesale on every catalogue refresh rather than appended to, for
 * the same reason as `tank_test_changes`: a test build is rebalanced mid-test
 * and disappears when it ships, so only its current state means anything.
 */
export const mapTestChanges = pgTable(
  "map_test_changes",
  {
    id: serial("id").primaryKey(),
    arenaId: text("arena_id").notNull(),
    /** The test build these values were read from, e.g. `2.4.0.5415`. */
    testVersion: text("test_version").notNull(),
    field: text("field").notNull(),
    previous: text("previous"),
    next: text("next"),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("map_test_changes_arena_idx").on(t.arenaId)],
);

export type MapSnapshotRow = typeof mapSnapshots.$inferSelect;
export type NewMapSnapshotRow = typeof mapSnapshots.$inferInsert;
export type MapChange = typeof mapChanges.$inferSelect;
export type NewMapChange = typeof mapChanges.$inferInsert;
export type MapTestChange = typeof mapTestChanges.$inferSelect;
export type NewMapTestChange = typeof mapTestChanges.$inferInsert;
