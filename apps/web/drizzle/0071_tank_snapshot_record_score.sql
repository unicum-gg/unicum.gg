-- The game's third block on a vehicle record, "Record Score": the best single
-- battle the player ever had on that tank.
--
-- Two columns where the game shows three lines. Wargaming puts `max_xp` and
-- `max_frags` at the top level of `tanks/stats`, beside `tank_id`, and they are
-- populated; the maximum damage exists only inside the per-mode blocks
-- (`random.max_damage`, `ranked_battles.max_damage`, …) and those answer 0 for
-- every tank of every account tried, so there is nothing to store for it.
--
-- Maxima rather than counters: they must never be diffed between two snapshots
-- (a record does not accrue), though unlike `tanking_factor` they do survive an
-- aggregate, as a max of maxima.
--
-- Written by hand for the same reason as 0070: `drizzle-kit` cannot see tables
-- built by a `makeXxxTable(region)` factory (see AGENTS.md). `ADD COLUMN` with
-- no default rewrites nothing in Postgres 11+.
ALTER TABLE "eu_tank_snapshots" ADD COLUMN IF NOT EXISTS "max_xp" integer;
ALTER TABLE "eu_tank_snapshots" ADD COLUMN IF NOT EXISTS "max_frags" integer;

ALTER TABLE "na_tank_snapshots" ADD COLUMN IF NOT EXISTS "max_xp" integer;
ALTER TABLE "na_tank_snapshots" ADD COLUMN IF NOT EXISTS "max_frags" integer;

ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "max_xp" integer;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "max_frags" integer;
