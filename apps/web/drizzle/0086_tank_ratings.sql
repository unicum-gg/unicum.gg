-- What players think of a vehicle, and the per-tank rollup the catalogue pages
-- read it back through.
--
-- Written by hand, not by `drizzle-kit generate`: the schema uses the
-- `makeXxxTable(region)` factory pattern, which drizzle-kit's AST analyser
-- cannot see into and answers with `DROP TABLE ... CASCADE` on every per-region
-- table. See AGENTS.md.
--
-- Global, like `tank_videos` and unlike `vehicles`: a tank is the same tank on
-- all three servers, so an opinion formed on EU is an opinion about the IS-7.
-- The voter's region is a column because their record is region-scoped, and
-- that is where the proof of experience is read from.

CREATE TABLE IF NOT EXISTS "tank_ratings" (
  "id" serial PRIMARY KEY NOT NULL,
  "tank_id" integer NOT NULL,
  -- An opinion is the person. It goes when they do, unlike a suggested video,
  -- which is a contribution to a library and outlives the account that found it.
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,

  "region" text NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,

  -- The quick vote, both required: a vote is a pair, and letting one side be
  -- skipped would silently change what each average is over.
  "overall" smallint NOT NULL,
  "fun" smallint NOT NULL,

  -- The optional detail, nullable per axis so an axis added later needs no
  -- backfill and reads as "not answered" on every existing row.
  "firepower" smallint,
  "armour" smallint,
  "mobility" smallint,
  "gun_handling" smallint,
  "concealment" smallint,
  "beginner_friendliness" smallint,
  "versatility" smallint,

  -- What the voter had actually done on this tank when they voted. Stored
  -- rather than joined at read time: it is what the opinion rested on, so it
  -- must not drift afterwards, and it turns the bracket split into a group-by
  -- here instead of a fan-out across three regional schemas.
  "battles" integer NOT NULL,
  "winrate" real,
  "avg_damage" real,
  "tank_wn8" real,
  "marks_on_gun" smallint,
  "mark_of_mastery" smallint,

  -- The voter themselves, same snapshot rule. This is what the bracket is cut
  -- on, and what makes "unicums rate it 4.6, everyone else 3.1" a query.
  "player_wn8" real,
  "player_battles" integer,
  "bracket" text DEFAULT 'unknown' NOT NULL,

  -- A tank is buffed and nerfed, and an opinion of it is an opinion of the
  -- version it was played in.
  "game_version" text,

  "review" text,
  "review_status" text DEFAULT 'none' NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" text,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

  -- The scale, enforced here as well as at the API boundary: these columns are
  -- averaged and any value outside the range would corrupt every roll-up
  -- silently rather than failing where it was introduced.
  CONSTRAINT "tank_ratings_overall_range" CHECK ("overall" BETWEEN 1 AND 5),
  CONSTRAINT "tank_ratings_fun_range" CHECK ("fun" BETWEEN 1 AND 5),
  CONSTRAINT "tank_ratings_firepower_range" CHECK ("firepower" IS NULL OR "firepower" BETWEEN 1 AND 5),
  CONSTRAINT "tank_ratings_armour_range" CHECK ("armour" IS NULL OR "armour" BETWEEN 1 AND 5),
  CONSTRAINT "tank_ratings_mobility_range" CHECK ("mobility" IS NULL OR "mobility" BETWEEN 1 AND 5),
  CONSTRAINT "tank_ratings_gun_handling_range" CHECK ("gun_handling" IS NULL OR "gun_handling" BETWEEN 1 AND 5),
  CONSTRAINT "tank_ratings_concealment_range" CHECK ("concealment" IS NULL OR "concealment" BETWEEN 1 AND 5),
  CONSTRAINT "tank_ratings_beginner_range" CHECK ("beginner_friendliness" IS NULL OR "beginner_friendliness" BETWEEN 1 AND 5),
  CONSTRAINT "tank_ratings_versatility_range" CHECK ("versatility" IS NULL OR "versatility" BETWEEN 1 AND 5)
);

-- One opinion per account per tank. Editing replaces, so this is also the
-- conflict target the submission upserts against.
CREATE UNIQUE INDEX IF NOT EXISTS "tank_ratings_tank_user_idx"
  ON "tank_ratings" ("tank_id", "user_id");

-- The tank page's own read: this vehicle's votes, grouped and split.
CREATE INDEX IF NOT EXISTS "tank_ratings_tank_idx"
  ON "tank_ratings" ("tank_id");

-- The same read cut by bracket, which is the split the page leads with.
CREATE INDEX IF NOT EXISTS "tank_ratings_tank_bracket_idx"
  ON "tank_ratings" ("tank_id", "bracket");

-- The moderation queue for written opinions, oldest first.
CREATE INDEX IF NOT EXISTS "tank_ratings_review_status_idx"
  ON "tank_ratings" ("review_status", "created_at");

-- A reader's own ratings, for their profile and the garage prompts.
CREATE INDEX IF NOT EXISTS "tank_ratings_user_idx"
  ON "tank_ratings" ("user_id");

-- The per-tank rollup the catalogue pages read.
--
-- The tank page does not use it: one vehicle's votes are an indexed group-by
-- that also produces a histogram, a bracket split and seven axis means, and
-- doing that live keeps the page honest the second a vote lands. The catalogue
-- is the opposite problem, eleven hundred vehicles at once behind an ISR
-- render, which is what this table exists for.
CREATE TABLE IF NOT EXISTS "tank_rating_aggregates" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "votes" integer DEFAULT 0 NOT NULL,
  "reviews" integer DEFAULT 0 NOT NULL,

  -- The plain means, which is what a five-star average means to a reader.
  "overall_avg" real,
  "fun_avg" real,
  -- The means the boards rank on: shrunk towards the site-wide mean, so a
  -- vehicle with four votes cannot sit above one with four hundred.
  "overall_bayes" real,
  "fun_bayes" real,
  "overall_stddev" real,

  -- Where the community's verdict sits among tanks of the same tier, and where
  -- the tank's measured win rate sits among the same set. Comparing across
  -- tiers would be comparing a tier II to a tier X.
  "perceived_percentile" real,
  "measured_percentile" real,
  -- perceived - measured. Positive means the community rates it above what it
  -- does. This is the overrated / underrated board, as one ORDER BY.
  "hype" real,

  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "tank_rating_aggregates_overall_idx"
  ON "tank_rating_aggregates" ("overall_bayes");

CREATE INDEX IF NOT EXISTS "tank_rating_aggregates_hype_idx"
  ON "tank_rating_aggregates" ("hype");
