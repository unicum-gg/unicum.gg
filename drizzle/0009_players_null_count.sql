-- Adds the soft-delete guard to <region>_players: `null_count` tracks
-- consecutive null responses from WG /wot/account/info/, `soft_deleted_at`
-- is stamped after 3 in a row and excludes the player from the snapshot
-- cron for 30 days. A successful WG fetch clears both fields. See
-- backfill-cron.ts for the read/write logic.

ALTER TABLE "eu_players"
  ADD COLUMN "null_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "soft_deleted_at" timestamp with time zone;

ALTER TABLE "na_players"
  ADD COLUMN "null_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "soft_deleted_at" timestamp with time zone;

ALTER TABLE "asia_players"
  ADD COLUMN "null_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "soft_deleted_at" timestamp with time zone;
