-- The by-language player boards get a win-rate column. The materialized
-- `*_player_ratings` table (recomputed hourly by the top-players cron) carries
-- the lifetime win rate so the board reads it without a join back to players.
--
-- Written by hand: `drizzle-kit` cannot see tables built by a
-- `makeXxxTable(region)` factory (see AGENTS.md). `ADD COLUMN` with no default
-- rewrites nothing in Postgres 11+; the cron backfills the column on its next
-- run (or the one-off recompute run alongside this migration).
ALTER TABLE "eu_player_ratings"   ADD COLUMN IF NOT EXISTS "winrate" real;
ALTER TABLE "na_player_ratings"   ADD COLUMN IF NOT EXISTS "winrate" real;
ALTER TABLE "asia_player_ratings" ADD COLUMN IF NOT EXISTS "winrate" real;
