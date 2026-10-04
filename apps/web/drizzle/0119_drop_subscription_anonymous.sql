-- Drop the anonymity flag the subscription row no longer owns (see 0118).
--
-- Separate from the migration that created its replacement, and applied AFTER
-- the deploy: the column is read by the supporter-badge queries, so dropping it
-- while the previous build is still serving turns every player page and the
-- supporters board into a 500. Once the new code is live, nothing reads it.

ALTER TABLE "subscription" DROP COLUMN IF EXISTS "anonymous";
