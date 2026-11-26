-- The 30-day histograms the profile's recent percentile reads. Written by hand
-- for the reason 0152 gives (see AGENTS.md, Database migrations). Run with a
-- lock timeout: an ALTER waiting behind a long backup queues every read of the
-- table after it.
SET lock_timeout = '2s';
ALTER TABLE "eu_player_distribution" ADD COLUMN IF NOT EXISTS "recent" jsonb;
ALTER TABLE "na_player_distribution" ADD COLUMN IF NOT EXISTS "recent" jsonb;
ALTER TABLE "asia_player_distribution" ADD COLUMN IF NOT EXISTS "recent" jsonb;
