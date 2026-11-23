-- The clan a supporter counts their support for. Written by hand: support_profile
-- is a global table, but drizzle-kit's view of the per-region factories makes
-- every generated migration here suspect (see AGENTS.md, Database migrations).
ALTER TABLE "support_profile" ADD COLUMN IF NOT EXISTS "clan_region" text;
ALTER TABLE "support_profile" ADD COLUMN IF NOT EXISTS "clan_id" bigint;
CREATE INDEX IF NOT EXISTS "support_profile_clan_idx" ON "support_profile" ("clan_region", "clan_id");
