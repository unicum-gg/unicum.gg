-- Extra tank_specs columns for the fuller characteristics table (tanks.gg parity):
-- clip size + ammo capacity, penetration at 500m, and the fuel-tank / turret-ring
-- (rotator) / viewport (surveying device) module HPs. All nullable; the vehicles
-- cron backfills them on its next run. Hand-written because db:generate cannot see
-- the makeXxxTable(region) factory tables and prompts to drop them.
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "clip_size" integer;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "penetration_500" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "ammo_capacity" integer;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "fuel_tank_health" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "turret_ring_health" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "viewport_health" real;
