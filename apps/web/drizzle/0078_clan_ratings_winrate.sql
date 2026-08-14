-- The clans landing board gets a win-rate column. The materialized
-- `*_clan_ratings` table (refreshed hourly by the top-clans cron) carries the
-- roster's battle-weighted mean win rate so the board reads it without a
-- re-aggregation, mirroring the player boards.
--
-- Written by hand: `drizzle-kit` cannot see tables built by a
-- `makeXxxTable(region)` factory (see AGENTS.md). `ADD COLUMN` with no default
-- rewrites nothing in Postgres 11+.
ALTER TABLE "eu_clan_ratings"   ADD COLUMN IF NOT EXISTS "winrate" real;
ALTER TABLE "na_clan_ratings"   ADD COLUMN IF NOT EXISTS "winrate" real;
ALTER TABLE "asia_clan_ratings" ADD COLUMN IF NOT EXISTS "winrate" real;
