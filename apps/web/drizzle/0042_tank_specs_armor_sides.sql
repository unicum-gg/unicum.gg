-- Hull and turret side/rear armor (front was already stored). From the vehicle
-- XML's `<primaryArmor>` list, which orders the three plates front, side, rear.
-- Nullable; backfilled by the vehicles cron. Hand-written (db:generate can't see
-- the makeXxxTable factory tables).
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "hull_armor_side" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "hull_armor_rear" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "turret_armor_side" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "turret_armor_rear" real;
