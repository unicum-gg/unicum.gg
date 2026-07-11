-- Economics columns on the global tank_specs table. buy/shell/ammo parsed from
-- wot-src; research XP from the WG encyclopedia. Additive + nullable.
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "buy_credits" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "buy_gold" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "research_xp" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "shell_cost" real;
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "ammo_cost" real;
