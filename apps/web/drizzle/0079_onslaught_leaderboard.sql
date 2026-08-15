-- Onslaught (Competitive 7) leaderboard: per-region standings + season metadata.
-- Hand-written because the makeXxxTable(region) factory pattern is invisible to
-- drizzle-kit (it only sees top-level pgTable calls), so db:generate cannot emit
-- these CREATEs. Fed by the private leaderboard feeder, read by the web board.

CREATE TABLE IF NOT EXISTS "eu_onslaught_ratings" (
  "event_id" text NOT NULL,
  "account_id" bigint NOT NULL,
  "rank" integer NOT NULL,
  "rating" integer NOT NULL,
  "battles" integer NOT NULL,
  "p1" integer,
  "name" text NOT NULL,
  "clan_tag" text,
  "clan_color" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "eu_onslaught_ratings_pk" PRIMARY KEY ("event_id", "account_id")
);
CREATE INDEX IF NOT EXISTS "eu_onslaught_ratings_event_rank_idx"
  ON "eu_onslaught_ratings" ("event_id", "rank");

CREATE TABLE IF NOT EXISTS "na_onslaught_ratings" (
  "event_id" text NOT NULL,
  "account_id" bigint NOT NULL,
  "rank" integer NOT NULL,
  "rating" integer NOT NULL,
  "battles" integer NOT NULL,
  "p1" integer,
  "name" text NOT NULL,
  "clan_tag" text,
  "clan_color" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "na_onslaught_ratings_pk" PRIMARY KEY ("event_id", "account_id")
);
CREATE INDEX IF NOT EXISTS "na_onslaught_ratings_event_rank_idx"
  ON "na_onslaught_ratings" ("event_id", "rank");

CREATE TABLE IF NOT EXISTS "asia_onslaught_ratings" (
  "event_id" text NOT NULL,
  "account_id" bigint NOT NULL,
  "rank" integer NOT NULL,
  "rating" integer NOT NULL,
  "battles" integer NOT NULL,
  "p1" integer,
  "name" text NOT NULL,
  "clan_tag" text,
  "clan_color" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "asia_onslaught_ratings_pk" PRIMARY KEY ("event_id", "account_id")
);
CREATE INDEX IF NOT EXISTS "asia_onslaught_ratings_event_rank_idx"
  ON "asia_onslaught_ratings" ("event_id", "rank");

CREATE TABLE IF NOT EXISTS "eu_onslaught_seasons" (
  "event_id" text PRIMARY KEY,
  "name" text NOT NULL,
  "start_date" timestamp with time zone,
  "end_date" timestamp with time zone,
  "elite_position" integer,
  "elite_points" integer,
  "master_position" integer,
  "last_recalculation_ts" bigint,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "na_onslaught_seasons" (
  "event_id" text PRIMARY KEY,
  "name" text NOT NULL,
  "start_date" timestamp with time zone,
  "end_date" timestamp with time zone,
  "elite_position" integer,
  "elite_points" integer,
  "master_position" integer,
  "last_recalculation_ts" bigint,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "asia_onslaught_seasons" (
  "event_id" text PRIMARY KEY,
  "name" text NOT NULL,
  "start_date" timestamp with time zone,
  "end_date" timestamp with time zone,
  "elite_position" integer,
  "elite_points" integer,
  "master_position" integer,
  "last_recalculation_ts" bigint,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
