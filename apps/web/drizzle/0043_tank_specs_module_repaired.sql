-- The auto-repair HP (the "repaired" figure) each module regenerates
-- to without a repair kit (the XML's `maxRegenHealth`), per module. Nullable;
-- backfilled by the vehicles cron. Hand-written (db:generate can't see factory tables).
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "track_repaired" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "ammo_rack_repaired" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "engine_repaired" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "fuel_tank_repaired" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "turret_ring_repaired" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "viewport_repaired" real;
