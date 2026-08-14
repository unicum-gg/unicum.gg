-- Steel Hunter HR reworked to be XP-centric: the game's XP per battle already
-- integrates damage, frags, spotting, survival time and placement, so it is the
-- single effectiveness axis (alongside win rate) instead of the old, partly
-- double-counting damage/frags/survival axes. This caches the average Steel
-- Hunter XP per battle on the players row, next to the other `sh_*` totals, so
-- the snapshot-cron can compute `hr` without a snapshots join.
--
-- Written by hand: `drizzle-kit` cannot see tables built by a
-- `makeXxxTable(region)` factory (see AGENTS.md). `ADD COLUMN` with no default
-- rewrites nothing in Postgres 11+.
ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "sh_avg_xp" real;
ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "sh_avg_xp" real;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "sh_avg_xp" real;
