-- The rest of the in-game vehicle record, so a player's page can show for a
-- tank what the client shows in Service Record → Statistics: the damage ratio
-- and the damage taken, the stuns an artillery piece landed and what they were
-- worth, the base capture, and Wargaming's armor use efficiency.
--
-- Wargaming already returns all five on the `tanks/stats` call the snapshot
-- pipeline makes; we simply never asked for them, so this costs no extra
-- request. Nullable and backfilled organically, like `xp`, `survived_battles`
-- and `damage_blocked` before them: old rows keep their NULLs and the page
-- renders a dash until the pipeline next writes that player.
--
-- Written by hand rather than generated. `drizzle-kit` cannot see tables built
-- by a `makeXxxTable(region)` factory and emits DROP TABLE for every one of
-- them (see AGENTS.md), so per-region migrations are authored here.
--
-- `ADD COLUMN` with no default rewrites nothing in Postgres 11+, which is what
-- makes this safe on a table this size.
--
-- `tanking_factor` is the only ratio in the table. Every other column is a
-- counter that sums across tanks and diffs between snapshots; this one does
-- neither, and is read only for the tank it belongs to.
ALTER TABLE "eu_tank_snapshots" ADD COLUMN IF NOT EXISTS "damage_received" bigint;
ALTER TABLE "eu_tank_snapshots" ADD COLUMN IF NOT EXISTS "capture_points" integer;
ALTER TABLE "eu_tank_snapshots" ADD COLUMN IF NOT EXISTS "stun_number" integer;
ALTER TABLE "eu_tank_snapshots" ADD COLUMN IF NOT EXISTS "stun_assisted_damage" bigint;
ALTER TABLE "eu_tank_snapshots" ADD COLUMN IF NOT EXISTS "tanking_factor" real;

ALTER TABLE "na_tank_snapshots" ADD COLUMN IF NOT EXISTS "damage_received" bigint;
ALTER TABLE "na_tank_snapshots" ADD COLUMN IF NOT EXISTS "capture_points" integer;
ALTER TABLE "na_tank_snapshots" ADD COLUMN IF NOT EXISTS "stun_number" integer;
ALTER TABLE "na_tank_snapshots" ADD COLUMN IF NOT EXISTS "stun_assisted_damage" bigint;
ALTER TABLE "na_tank_snapshots" ADD COLUMN IF NOT EXISTS "tanking_factor" real;

ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "damage_received" bigint;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "capture_points" integer;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "stun_number" integer;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "stun_assisted_damage" bigint;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "tanking_factor" real;
