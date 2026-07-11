-- Rename the Mark-of-Mastery threshold tables to `mom` for symmetry with the
-- Marks-of-Excellence `moe` tables. Pure rename: data, columns, and the primary
-- key are all preserved. (The auto-named `*_pkey` constraints keep their old
-- names, which is cosmetic and invisible to Drizzle.)
ALTER TABLE IF EXISTS "eu_tank_mastery" RENAME TO "eu_tank_mom";
ALTER TABLE IF EXISTS "na_tank_mastery" RENAME TO "na_tank_mom";
ALTER TABLE IF EXISTS "asia_tank_mastery" RENAME TO "asia_tank_mom";
