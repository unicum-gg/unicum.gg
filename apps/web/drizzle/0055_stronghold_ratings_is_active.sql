-- Add `is_active` to the materialized stronghold leaderboards (per region).
-- The board query filters on it (only rank clans with a positive 30-day battle
-- diff); the clan page reads a clan's own SR ignoring it, so a tier a clan
-- played historically but not recently still shows its rating. Defaults to true
-- so existing rows keep ranking until the hourly cron recomputes the flag.
-- Hand-written: the per-region factory pattern (`makeStrongholdRatingsTable`)
-- is invisible to drizzle-kit, so this is applied manually per AGENTS.md.

ALTER TABLE "eu_stronghold_ratings" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "na_stronghold_ratings" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "asia_stronghold_ratings" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
