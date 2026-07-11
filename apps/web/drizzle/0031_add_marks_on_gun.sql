-- Marks of Excellence on the gun (0-3), sourced from the WoT portal. Nullable
-- and organically backfilled as refreshes reach the portal, like xp/mark_of_mastery.
ALTER TABLE "eu_tank_snapshots" ADD COLUMN IF NOT EXISTS "marks_on_gun" integer;
ALTER TABLE "na_tank_snapshots" ADD COLUMN IF NOT EXISTS "marks_on_gun" integer;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "marks_on_gun" integer;
