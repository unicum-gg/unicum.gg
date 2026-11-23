-- When a support subscription began, as Stripe dates it: the supporter's
-- seniority, which the crest's metal (bronze, silver, gold) is read from.
-- Existing rows take their creation date, which is when the webhook first saw
-- them; the next subscription event rewrites it with Stripe's own start_date.
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "started_at" timestamp;
UPDATE "subscription" SET "started_at" = "created_at" WHERE "started_at" IS NULL;
