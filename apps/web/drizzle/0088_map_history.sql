-- How the game's maps change from one version to the next: play areas resized,
-- game modes gained or lost, bases and spawns moved, maps added to and pulled
-- from the client. Global like the tank history (Wargaming ships the same maps
-- to every server).
--
-- Maps carry no numeric characteristics the way vehicles do, so `previous` and
-- `next` are text: a number, a camouflage token, a presence sentinel, or a
-- serialized marker list the minimap overlay reads back.

-- A map's tracked state at a game version, the point the next version is diffed
-- against. Immutable per version, so a mid-patch mirror correction never reads
-- as a rework. `name` is kept because arena ids are re-used (the Grand Battle
-- arena `212_epic_random_valley_sm25` came back as Nebelburg), and the name is
-- what tells a rework from a different map at the same id.
CREATE TABLE IF NOT EXISTS "map_snapshots" (
  "arena_id" text NOT NULL,
  "game_version" text NOT NULL,
  "data" jsonb NOT NULL,
  "name" text NOT NULL,
  "captured_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "map_snapshots_pk" PRIMARY KEY ("arena_id", "game_version")
);
CREATE INDEX IF NOT EXISTS "map_snapshots_arena_idx" ON "map_snapshots" ("arena_id", "captured_at");

-- One recorded change at a game-version bump. `field` is a tracked scalar
-- (`roundLength`), a mode or battle type gained or lost (`mode:standard`), a
-- marker group (`geometry:ctf:bases:team1`), or the map entering/leaving the
-- game (`presence`).
CREATE TABLE IF NOT EXISTS "map_changes" (
  "id" serial PRIMARY KEY,
  "arena_id" text NOT NULL,
  "game_version" text NOT NULL,
  "field" text NOT NULL,
  "previous" text,
  "next" text,
  "captured_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "map_changes_arena_idx" ON "map_changes" ("arena_id", "captured_at");
CREATE INDEX IF NOT EXISTS "map_changes_captured_idx" ON "map_changes" ("captured_at");

-- What the Common Test client changes about the maps the live one already has:
-- `previous` is the live value, `next` the test one. Rewritten wholesale on
-- every catalogue refresh, like `tank_test_changes`.
CREATE TABLE IF NOT EXISTS "map_test_changes" (
  "id" serial PRIMARY KEY,
  "arena_id" text NOT NULL,
  "test_version" text NOT NULL,
  "field" text NOT NULL,
  "previous" text,
  "next" text,
  "captured_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "map_test_changes_arena_idx" ON "map_test_changes" ("arena_id");
