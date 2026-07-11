-- Tech-tree links + cumulative research XP from a tier-1 starter, on the global
-- tank_specs table. previous_tanks/next_tanks are the WG encyclopedia prices_xp
-- parents and next_tanks children; total_free_xp is the cheapest-path cumulative
-- XP to research the tank from tier 1. Additive + nullable.
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "previous_tanks" integer[];
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "next_tanks" integer[];
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "total_free_xp" real;
