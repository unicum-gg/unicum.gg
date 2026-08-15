-- Materialize each ranked player's CURRENT nickname/clan (resolved by account_id)
-- onto the Onslaught standings, so the board read is a pure indexed DB read
-- instead of resolving a few thousand accounts against WG on every request
-- (which took ~52s for EU). The reconcile job fills these; the board falls back
-- to the recorded values while a row is unresolved.

ALTER TABLE "eu_onslaught_ratings" ADD COLUMN IF NOT EXISTS "current_name" text;
ALTER TABLE "eu_onslaught_ratings" ADD COLUMN IF NOT EXISTS "current_clan_tag" text;
ALTER TABLE "eu_onslaught_ratings" ADD COLUMN IF NOT EXISTS "current_clan_color" text;

ALTER TABLE "na_onslaught_ratings" ADD COLUMN IF NOT EXISTS "current_name" text;
ALTER TABLE "na_onslaught_ratings" ADD COLUMN IF NOT EXISTS "current_clan_tag" text;
ALTER TABLE "na_onslaught_ratings" ADD COLUMN IF NOT EXISTS "current_clan_color" text;

ALTER TABLE "asia_onslaught_ratings" ADD COLUMN IF NOT EXISTS "current_name" text;
ALTER TABLE "asia_onslaught_ratings" ADD COLUMN IF NOT EXISTS "current_clan_tag" text;
ALTER TABLE "asia_onslaught_ratings" ADD COLUMN IF NOT EXISTS "current_clan_color" text;
