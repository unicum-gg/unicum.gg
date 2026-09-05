-- Split the events feed's freshness out of `last_refreshed_at`.
--
-- `refreshClanEvents` stamped `last_refreshed_at`, which means "the full clan
-- refresh ran" (info + roster + events + Global Map) and is what the backfill's
-- due-scan orders by. But that function is fired in the background by
-- `getClanEventsCached` on any clan page hit, crawlers included, after pulling
-- nothing but the event feed. So the more a clan's page was read, the more
-- reliably it looked fresh to the scan, and the longer everything else about it
-- went unrefreshed.
--
-- Measured on EU before the split: 42,452 clans reported a refresh inside 24h,
-- of which 5,891 carried Stronghold data more than a week old.
ALTER TABLE "eu_clans"   ADD COLUMN IF NOT EXISTS "events_refreshed_at" timestamp with time zone;
ALTER TABLE "na_clans"   ADD COLUMN IF NOT EXISTS "events_refreshed_at" timestamp with time zone;
ALTER TABLE "asia_clans" ADD COLUMN IF NOT EXISTS "events_refreshed_at" timestamp with time zone;

-- Seed from the column it was being conflated with. Those timestamps were, for
-- the most part, written BY the events refresh, so they are the right starting
-- point, and seeding keeps day one behaviourally identical instead of having
-- every clan page hit fire a background event refetch on a null column at once.
UPDATE "eu_clans"   SET "events_refreshed_at" = "last_refreshed_at" WHERE "events_refreshed_at" IS NULL;
UPDATE "na_clans"   SET "events_refreshed_at" = "last_refreshed_at" WHERE "events_refreshed_at" IS NULL;
UPDATE "asia_clans" SET "events_refreshed_at" = "last_refreshed_at" WHERE "events_refreshed_at" IS NULL;
