-- Total battles played on a tank (server-wide sample size) for the /tanks
-- "Battles" column, distinct from avg_battles (per-player). Hand-written for the
-- per-region factory tables. Additive + nullable; populated by the next by-tank
-- cron run.
ALTER TABLE "eu_tank_stats"   ADD COLUMN IF NOT EXISTS "total_battles" bigint;
ALTER TABLE "na_tank_stats"   ADD COLUMN IF NOT EXISTS "total_battles" bigint;
ALTER TABLE "asia_tank_stats" ADD COLUMN IF NOT EXISTS "total_battles" bigint;
