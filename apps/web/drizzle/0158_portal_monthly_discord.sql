-- The Discord scheduled event each monthly calendar entry is published as,
-- like *_portal_events carries for the home widget's. Written by hand (see
-- AGENTS.md). Additive and nullable, so it is safe ahead of the deploy.
SET lock_timeout = '2s';
ALTER TABLE "eu_portal_monthly_events" ADD COLUMN IF NOT EXISTS "discord_event_id" text;
ALTER TABLE "eu_portal_monthly_events" ADD COLUMN IF NOT EXISTS "discord_synced_hash" text;
ALTER TABLE "na_portal_monthly_events" ADD COLUMN IF NOT EXISTS "discord_event_id" text;
ALTER TABLE "na_portal_monthly_events" ADD COLUMN IF NOT EXISTS "discord_synced_hash" text;
ALTER TABLE "asia_portal_monthly_events" ADD COLUMN IF NOT EXISTS "discord_event_id" text;
ALTER TABLE "asia_portal_monthly_events" ADD COLUMN IF NOT EXISTS "discord_synced_hash" text;
