-- Reward / special vehicle flag (the `special` tag: earned tanks like campaign
-- rewards). Distinct from premium (sold). Additive, defaults false, backfilled
-- by the vehicles cron.
ALTER TABLE "eu_vehicles"   ADD COLUMN IF NOT EXISTS "is_reward" boolean NOT NULL DEFAULT false;
ALTER TABLE "na_vehicles"   ADD COLUMN IF NOT EXISTS "is_reward" boolean NOT NULL DEFAULT false;
ALTER TABLE "asia_vehicles" ADD COLUMN IF NOT EXISTS "is_reward" boolean NOT NULL DEFAULT false;
