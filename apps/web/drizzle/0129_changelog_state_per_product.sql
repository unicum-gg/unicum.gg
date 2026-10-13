-- One changelog marker per product, instead of one for the whole site.
--
-- The table was a singleton (`id = 1`, guarded by a check constraint) for as
-- long as the site was the only thing that announced anything. The client mod
-- is the second, and its marker is a release tag where the site's is a commit
-- sha, hence `last_published_ref`: one column honestly naming both rather than
-- a `sha` column holding tags.
--
-- Hand-written rather than generated. Two reasons. Dropping a check, dropping a
-- primary key and adding another one is exactly the shape drizzle-kit is least
-- worth trusting on, and the single row this table holds is not data that can
-- be recomputed: it is the only record of how far the community channel has
-- already been told, so losing it makes the next run republish a week the
-- readers have already read.
--
-- In a transaction on purpose, since this is applied by hand with `psql -f`
-- (the journal on disk is not authoritative here): a half-applied key swap
-- leaves the table with no primary key at all.
BEGIN;

-- Fail rather than queue, which is not a precaution but a repair: run without
-- it, the first ALTER below waited on the nightly `pg_dump`, which takes an
-- AccessShareLock on every table at the start of its snapshot and holds it for
-- the hours it spends on `eu_tank_snapshots`. A pending AccessExclusiveLock
-- queues AHEAD of everything that arrives after it, so the ALTER did not merely
-- wait: it blocked every reader of this table behind it, and killing the client
-- did not help, since a backend blocked on a lock never writes to its socket
-- and so never notices its client is gone.
--
-- Three seconds because the lock is either free or held by something that runs
-- for hours; there is no middle case worth waiting out. A failed attempt costs
-- nothing and blocks nobody, so this is safe to simply retry.
SET lock_timeout = '3s';

-- The value survives the rename, which is the whole point of doing it this way
-- rather than adding a column and copying.
ALTER TABLE "changelog_state"
  RENAME COLUMN "last_published_sha" TO "last_published_ref";

-- Nullable first, so the row that already exists can be named before the
-- constraint is asked to hold.
ALTER TABLE "changelog_state" ADD COLUMN "product" text;
UPDATE "changelog_state" SET "product" = 'web' WHERE "product" IS NULL;
ALTER TABLE "changelog_state" ALTER COLUMN "product" SET NOT NULL;

-- The guard that made a second row impossible, and the key it guarded.
ALTER TABLE "changelog_state" DROP CONSTRAINT IF EXISTS "changelog_state_singleton";
ALTER TABLE "changelog_state" DROP CONSTRAINT IF EXISTS "changelog_state_pkey";
ALTER TABLE "changelog_state" DROP COLUMN "id";

ALTER TABLE "changelog_state" ADD CONSTRAINT "changelog_state_pkey" PRIMARY KEY ("product");

COMMIT;
