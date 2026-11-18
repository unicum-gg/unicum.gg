-- How far the window refresh has caught up, per region, and the index its
-- hourly read of `*_player_snapshots` by `taken_at` needs.
--
-- Written by hand rather than by `drizzle-kit generate`: the schema uses the
-- `makeXxxTable(region)` factory pattern, which drizzle-kit's AST analyser
-- cannot see into and answers with `DROP TABLE ... CASCADE` on every per-region
-- table. See AGENTS.md.

CREATE TABLE IF NOT EXISTS "window_refresh_state" (
  "region" text PRIMARY KEY NOT NULL,
  "processed_until" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Start from the day of the last full backfill (2026-11-12, which rewrote every
-- account over several hours, so the start of that day is the safe side of all
-- of them), and the hourly ticks catch up on everything that has aged out of a
-- window since, a bounded slice at a time.
INSERT INTO "window_refresh_state" ("region", "processed_until") VALUES
  ('eu', '2026-11-12 00:00:00+00'),
  ('na', '2026-11-12 00:00:00+00'),
  ('asia', '2026-11-12 00:00:00+00')
ON CONFLICT ("region") DO NOTHING;

-- A plain btree. BRIN was tried first, since rows land roughly in `taken_at`
-- order (correlation 0.93 to 0.96), and it was useless: rows recycled into
-- freed space spread each block range over months, so a one-hour band read 1.67
-- million of EU's blocks, the same as a full scan. Measured at 758 MB on EU,
-- 90 MB on NA, 69 MB on Asia, and inserted at the right edge, so it costs the
-- pipeline little. CONCURRENTLY so the pipeline keeps writing while they build
-- (70 seconds on EU); psql runs each statement on its own.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "eu_snapshots_taken_at_idx"
  ON "eu_player_snapshots" ("taken_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "na_snapshots_taken_at_idx"
  ON "na_player_snapshots" ("taken_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "asia_snapshots_taken_at_idx"
  ON "asia_player_snapshots" ("taken_at");
