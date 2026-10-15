-- Every account eligible for a recent player leaderboard window (24h, 7d,
-- 30d), with its ratings over that window and its inferred languages.
--
-- The recent boards could not be filtered by language: the inference only
-- exists for the lifetime pool (`player_ratings`, 10k battles and a top-10k
-- metric), so the recent windows on /players had no language filter. The
-- top-players cron now fills this table hourly with the same SQL inference,
-- for every account a window ranks rather than its top 1000, so the French
-- board over 30 days ranks every French player active over 30 days.
--
-- Additive only: three new tables, no existing one is touched.

CREATE TABLE IF NOT EXISTS "eu_player_period_ratings" (
  "period" text NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "battles" integer NOT NULL,
  "wins" integer,
  "wn7" real,
  "wn8" real,
  "wnx" real,
  "languages" text[] DEFAULT '{}'::text[] NOT NULL,
  "languages_at" timestamp with time zone,
  "clan_tag" text,
  "clan_color" text,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "eu_player_period_ratings_period_account_id_pk" PRIMARY KEY ("period", "account_id")
);
CREATE INDEX IF NOT EXISTS "eu_player_period_ratings_languages_idx" ON "eu_player_period_ratings" USING gin ("languages");
CREATE INDEX IF NOT EXISTS "eu_player_period_ratings_wn7_idx" ON "eu_player_period_ratings" ("period", "wn7" DESC);
CREATE INDEX IF NOT EXISTS "eu_player_period_ratings_wn8_idx" ON "eu_player_period_ratings" ("period", "wn8" DESC);
CREATE INDEX IF NOT EXISTS "eu_player_period_ratings_wnx_idx" ON "eu_player_period_ratings" ("period", "wnx" DESC);

CREATE TABLE IF NOT EXISTS "na_player_period_ratings" (
  "period" text NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "battles" integer NOT NULL,
  "wins" integer,
  "wn7" real,
  "wn8" real,
  "wnx" real,
  "languages" text[] DEFAULT '{}'::text[] NOT NULL,
  "languages_at" timestamp with time zone,
  "clan_tag" text,
  "clan_color" text,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "na_player_period_ratings_period_account_id_pk" PRIMARY KEY ("period", "account_id")
);
CREATE INDEX IF NOT EXISTS "na_player_period_ratings_languages_idx" ON "na_player_period_ratings" USING gin ("languages");
CREATE INDEX IF NOT EXISTS "na_player_period_ratings_wn7_idx" ON "na_player_period_ratings" ("period", "wn7" DESC);
CREATE INDEX IF NOT EXISTS "na_player_period_ratings_wn8_idx" ON "na_player_period_ratings" ("period", "wn8" DESC);
CREATE INDEX IF NOT EXISTS "na_player_period_ratings_wnx_idx" ON "na_player_period_ratings" ("period", "wnx" DESC);

CREATE TABLE IF NOT EXISTS "asia_player_period_ratings" (
  "period" text NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "battles" integer NOT NULL,
  "wins" integer,
  "wn7" real,
  "wn8" real,
  "wnx" real,
  "languages" text[] DEFAULT '{}'::text[] NOT NULL,
  "languages_at" timestamp with time zone,
  "clan_tag" text,
  "clan_color" text,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "asia_player_period_ratings_period_account_id_pk" PRIMARY KEY ("period", "account_id")
);
CREATE INDEX IF NOT EXISTS "asia_player_period_ratings_languages_idx" ON "asia_player_period_ratings" USING gin ("languages");
CREATE INDEX IF NOT EXISTS "asia_player_period_ratings_wn7_idx" ON "asia_player_period_ratings" ("period", "wn7" DESC);
CREATE INDEX IF NOT EXISTS "asia_player_period_ratings_wn8_idx" ON "asia_player_period_ratings" ("period", "wn8" DESC);
CREATE INDEX IF NOT EXISTS "asia_player_period_ratings_wnx_idx" ON "asia_player_period_ratings" ("period", "wnx" DESC);
