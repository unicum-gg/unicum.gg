-- Rank the recent player leaderboards (24h, 7d, 30d) by the battles fought at
-- or above a tier floor (6, 8, 10), so a low-tier farm cannot carry them. On
-- 2026-10-21, 19 of the 30-day WN8 board's top 20 on EU had averaged tier 3 to 5
-- over the month.
--
-- `*_player_tier_window_ratings` holds each account's window ratings per floor,
-- written by the snapshot path. `*_player_period_ratings` (the hourly board)
-- gains the floor in its key. Its existing rows are all-tier figures and are
-- labelled 6 by the default until the next hourly pass rewrites them, which is
-- also what keeps this migration safe to apply before the code that reads it.

-- One transaction, so a board read never lands between the dropped and the
-- recreated indexes.
BEGIN;

CREATE TABLE IF NOT EXISTS "eu_player_tier_window_ratings" (
  "account_id" bigint NOT NULL,
  "period" text NOT NULL,
  "min_tier" smallint NOT NULL,
  "battles" integer NOT NULL,
  "wins" integer NOT NULL,
  "wn7" real,
  "wn8" real,
  "wnx" real,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "eu_player_tier_window_ratings_account_id_period_min_tier_pk" PRIMARY KEY ("account_id", "period", "min_tier")
);
CREATE INDEX IF NOT EXISTS "eu_player_tier_window_ratings_pool_idx" ON "eu_player_tier_window_ratings" ("period", "min_tier");

ALTER TABLE "eu_player_period_ratings" ADD COLUMN IF NOT EXISTS "min_tier" smallint DEFAULT 6 NOT NULL;
ALTER TABLE "eu_player_period_ratings" DROP CONSTRAINT IF EXISTS "eu_player_period_ratings_period_account_id_pk";
ALTER TABLE "eu_player_period_ratings" ADD CONSTRAINT "eu_player_period_ratings_period_min_tier_account_id_pk" PRIMARY KEY ("period", "min_tier", "account_id");
DROP INDEX IF EXISTS "eu_player_period_ratings_wn7_idx";
DROP INDEX IF EXISTS "eu_player_period_ratings_wn8_idx";
DROP INDEX IF EXISTS "eu_player_period_ratings_wnx_idx";
CREATE INDEX IF NOT EXISTS "eu_player_period_ratings_wn7_idx" ON "eu_player_period_ratings" ("period", "min_tier", "wn7" DESC);
CREATE INDEX IF NOT EXISTS "eu_player_period_ratings_wn8_idx" ON "eu_player_period_ratings" ("period", "min_tier", "wn8" DESC);
CREATE INDEX IF NOT EXISTS "eu_player_period_ratings_wnx_idx" ON "eu_player_period_ratings" ("period", "min_tier", "wnx" DESC);

CREATE TABLE IF NOT EXISTS "na_player_tier_window_ratings" (
  "account_id" bigint NOT NULL,
  "period" text NOT NULL,
  "min_tier" smallint NOT NULL,
  "battles" integer NOT NULL,
  "wins" integer NOT NULL,
  "wn7" real,
  "wn8" real,
  "wnx" real,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "na_player_tier_window_ratings_account_id_period_min_tier_pk" PRIMARY KEY ("account_id", "period", "min_tier")
);
CREATE INDEX IF NOT EXISTS "na_player_tier_window_ratings_pool_idx" ON "na_player_tier_window_ratings" ("period", "min_tier");

ALTER TABLE "na_player_period_ratings" ADD COLUMN IF NOT EXISTS "min_tier" smallint DEFAULT 6 NOT NULL;
ALTER TABLE "na_player_period_ratings" DROP CONSTRAINT IF EXISTS "na_player_period_ratings_period_account_id_pk";
ALTER TABLE "na_player_period_ratings" ADD CONSTRAINT "na_player_period_ratings_period_min_tier_account_id_pk" PRIMARY KEY ("period", "min_tier", "account_id");
DROP INDEX IF EXISTS "na_player_period_ratings_wn7_idx";
DROP INDEX IF EXISTS "na_player_period_ratings_wn8_idx";
DROP INDEX IF EXISTS "na_player_period_ratings_wnx_idx";
CREATE INDEX IF NOT EXISTS "na_player_period_ratings_wn7_idx" ON "na_player_period_ratings" ("period", "min_tier", "wn7" DESC);
CREATE INDEX IF NOT EXISTS "na_player_period_ratings_wn8_idx" ON "na_player_period_ratings" ("period", "min_tier", "wn8" DESC);
CREATE INDEX IF NOT EXISTS "na_player_period_ratings_wnx_idx" ON "na_player_period_ratings" ("period", "min_tier", "wnx" DESC);

CREATE TABLE IF NOT EXISTS "asia_player_tier_window_ratings" (
  "account_id" bigint NOT NULL,
  "period" text NOT NULL,
  "min_tier" smallint NOT NULL,
  "battles" integer NOT NULL,
  "wins" integer NOT NULL,
  "wn7" real,
  "wn8" real,
  "wnx" real,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "asia_player_tier_window_ratings_account_id_period_min_tier_pk" PRIMARY KEY ("account_id", "period", "min_tier")
);
CREATE INDEX IF NOT EXISTS "asia_player_tier_window_ratings_pool_idx" ON "asia_player_tier_window_ratings" ("period", "min_tier");

ALTER TABLE "asia_player_period_ratings" ADD COLUMN IF NOT EXISTS "min_tier" smallint DEFAULT 6 NOT NULL;
ALTER TABLE "asia_player_period_ratings" DROP CONSTRAINT IF EXISTS "asia_player_period_ratings_period_account_id_pk";
ALTER TABLE "asia_player_period_ratings" ADD CONSTRAINT "asia_player_period_ratings_period_min_tier_account_id_pk" PRIMARY KEY ("period", "min_tier", "account_id");
DROP INDEX IF EXISTS "asia_player_period_ratings_wn7_idx";
DROP INDEX IF EXISTS "asia_player_period_ratings_wn8_idx";
DROP INDEX IF EXISTS "asia_player_period_ratings_wnx_idx";
CREATE INDEX IF NOT EXISTS "asia_player_period_ratings_wn7_idx" ON "asia_player_period_ratings" ("period", "min_tier", "wn7" DESC);
CREATE INDEX IF NOT EXISTS "asia_player_period_ratings_wn8_idx" ON "asia_player_period_ratings" ("period", "min_tier", "wn8" DESC);
CREATE INDEX IF NOT EXISTS "asia_player_period_ratings_wnx_idx" ON "asia_player_period_ratings" ("period", "min_tier", "wnx" DESC);

COMMIT;
