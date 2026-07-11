-- Tankopedia historical description (WG encyclopedia, English) on the global
-- tank_specs table. Additive + nullable.
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "description" text;
