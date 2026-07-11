-- Add the WoT vehicle role token (e.g. role_HT_assault) to each per-region
-- vehicles table. Hand-written: drizzle-kit cannot see the makeVehiclesTable
-- factory and would emit DROP TABLE for the eu/na/asia tables. Additive and
-- backfilled by the daily vehicles cron (refreshVehicles).
ALTER TABLE "eu_vehicles" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "na_vehicles" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "asia_vehicles" ADD COLUMN IF NOT EXISTS "role" text;
