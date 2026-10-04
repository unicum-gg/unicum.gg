-- Community ratings for maps: one vote per account per arena, plus the rollup
-- the lists read.
--
-- Written by hand rather than generated. `drizzle-kit generate` cannot read the
-- per-region table factories (`makeXxxTable(region)`), so it treats every
-- `eu_*`/`na_*`/`asia_*` table as unknown and stops on an interactive rename
-- prompt. Both statements below are purely additive: nothing here drops,
-- renames or rewrites an existing object.
--
-- Keyed on the client's own arena id rather than on the slug, because the slug
-- is derived from the English name and a renamed map keeps its id. Same key the
-- change history and the video library already use.

CREATE TABLE IF NOT EXISTS "map_ratings" (
  "id" serial PRIMARY KEY NOT NULL,
  "arena_id" text NOT NULL,
  "user_id" text NOT NULL,
  "region" text NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "overall" smallint NOT NULL,
  "fun" smallint NOT NULL,
  "balance" smallint,
  "variety" smallint,
  "flow" smallint,
  "class_fairness" smallint,
  "beginner_friendliness" smallint,
  "player_wn8" real,
  "player_battles" integer,
  "player_winrate" real,
  "player_recent_battles" integer,
  "bracket" text DEFAULT 'unknown' NOT NULL,
  "game_version" text,
  "review" text,
  "review_status" text DEFAULT 'none' NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- An opinion is the person, so it goes when they do. The vehicle votes cascade
-- for the same reason, and unlike a suggested video, which is a contribution to
-- a library and outlives the account that found it.
DO $$ BEGIN
  ALTER TABLE "map_ratings"
    ADD CONSTRAINT "map_ratings_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- One opinion per account per arena, which is the conflict target the
-- submission upserts against: editing replaces rather than accumulates.
CREATE UNIQUE INDEX IF NOT EXISTS "map_ratings_arena_user_idx"
  ON "map_ratings" ("arena_id","user_id");
--> statement-breakpoint
-- The map page's own read.
CREATE INDEX IF NOT EXISTS "map_ratings_arena_idx"
  ON "map_ratings" ("arena_id");
--> statement-breakpoint
-- The same read cut by bracket, which is the split the panel leads with.
CREATE INDEX IF NOT EXISTS "map_ratings_arena_bracket_idx"
  ON "map_ratings" ("arena_id","bracket");
--> statement-breakpoint
-- The moderation queue, oldest first.
CREATE INDEX IF NOT EXISTS "map_ratings_review_status_idx"
  ON "map_ratings" ("review_status","created_at");
--> statement-breakpoint
-- A reader's own ratings.
CREATE INDEX IF NOT EXISTS "map_ratings_user_idx"
  ON "map_ratings" ("user_id");
--> statement-breakpoint

-- The rollup. Deliberately two columns shorter than the vehicle one: there is
-- no `hype` here, because that column is the community's rank inside a tier
-- minus the subject's measured win-rate rank inside the same tier, and a map
-- has neither a tier nor a per-arena win rate anybody publishes.
CREATE TABLE IF NOT EXISTS "map_rating_aggregates" (
  "arena_id" text PRIMARY KEY NOT NULL,
  "votes" integer DEFAULT 0 NOT NULL,
  "reviews" integer DEFAULT 0 NOT NULL,
  "overall_avg" real,
  "fun_avg" real,
  "overall_bayes" real,
  "fun_bayes" real,
  "overall_stddev" real,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- The board: best rated first.
CREATE INDEX IF NOT EXISTS "map_rating_aggregates_overall_idx"
  ON "map_rating_aggregates" ("overall_bayes");
