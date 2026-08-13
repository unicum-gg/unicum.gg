-- When the battles in a snapshot were actually fought, rather than when we
-- happened to look.
--
-- The sessions view dates a stretch of play by subtracting two consecutive
-- snapshots, and without this it can only date it by the later snapshot's
-- `taken_at`. An evening session sampled after midnight then lands on the wrong
-- day. Wargaming's `account/info` carries `last_battle_time` and the pipeline
-- already reads it (it is the change detector), so this costs no request: it is
-- the same value, kept per snapshot instead of only as the player's current one.
--
-- Nullable and filled going forward. Sessions built from older snapshots keep
-- falling back to the observation time, which is what they were built on anyway.
--
-- Written by hand: `drizzle-kit` cannot see tables built by a
-- `makeXxxTable(region)` factory (see AGENTS.md). `ADD COLUMN` with no default
-- rewrites nothing in Postgres 11+.
ALTER TABLE "eu_player_snapshots" ADD COLUMN IF NOT EXISTS "last_battle_at" timestamp with time zone;
ALTER TABLE "na_player_snapshots" ADD COLUMN IF NOT EXISTS "last_battle_at" timestamp with time zone;
ALTER TABLE "asia_player_snapshots" ADD COLUMN IF NOT EXISTS "last_battle_at" timestamp with time zone;
