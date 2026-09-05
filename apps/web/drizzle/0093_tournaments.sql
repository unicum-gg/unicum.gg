-- Wargaming's own tournaments, mirrored from the tournament system
-- (`worldoftanks.<tld>/tmsis/`): the catalogue, every registered team with its
-- roster, and the full bracket with scores.
--
-- Hand-written for the same reason as 0079: the makeXxxTable(region) factory
-- pattern is invisible to drizzle-kit (it only reads top-level pgTable calls),
-- so `db:generate` cannot emit these CREATEs and asks to resolve them as
-- renames of existing per-region tables instead.
--
-- Why mirror at all: none of this reaches the public WG API, and Wargaming's own
-- pages render the rosters and brackets client-side, so who played and who won
-- is published nowhere that survives without running their JavaScript. Rosters
-- carry account ids, which is what lets a tournament record hang off the player
-- and clan pages. The archive goes back to 2018 and a settled bracket never
-- changes again, so this is a write-once mirror with a small daily tail.
--
-- The captain's `contacts` field is deliberately not stored. The endpoint
-- returns it (a Discord handle, a phone number), but it is contact detail a
-- player gave to be reached during their tournament, not something they
-- published.


-- ---- EU ----

-- The catalogue row. `detail_synced_at` is null until the per-tournament fetch
-- has run, so it separates a tournament we merely listed from one we mirrored in
-- full, and it is what the backfill claims its next batch on.
CREATE TABLE IF NOT EXISTS "eu_tournaments" (
  "id" bigint PRIMARY KEY,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "language" text DEFAULT 'en' NOT NULL,
  "status" text NOT NULL,
  "game_modes" text[] DEFAULT '{}' NOT NULL,
  "tier_from" integer,
  "tier_to" integer,
  "min_players_in_team" integer NOT NULL,
  "max_players_in_team" integer NOT NULL,
  "teams_limit" integer,
  "confirmed_teams" integer DEFAULT 0 NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "registration_from" timestamp with time zone,
  "registration_till" timestamp with time zone,
  "prize" text,
  "prize_tiers" jsonb,
  "rules" jsonb,
  "tags" jsonb,
  "logo_url" text,
  "is_featured" boolean DEFAULT false NOT NULL,
  "map_pool" text[],
  "bracket_types" text[],
  "total_level_from" integer,
  "total_level_to" integer,
  "schedule" jsonb,
  "detail_synced_at" timestamp with time zone,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "eu_tournaments_status_start_idx"
  ON "eu_tournaments" ("status", "start_at" DESC);
CREATE INDEX IF NOT EXISTS "eu_tournaments_start_idx"
  ON "eu_tournaments" ("start_at" DESC);
CREATE INDEX IF NOT EXISTS "eu_tournaments_detail_sync_idx"
  ON "eu_tournaments" ("detail_synced_at");

-- One entry in a tournament. Teams are formed per tournament, not persistent:
-- the same five players enter next week's under a new name and a new id.
CREATE TABLE IF NOT EXISTS "eu_tournament_teams" (
  "id" bigint PRIMARY KEY,
  "tournament_id" bigint NOT NULL,
  "title" text NOT NULL,
  "status" text NOT NULL,
  "owner_account_id" bigint,
  "players_count" integer DEFAULT 0 NOT NULL,
  "max_players" integer DEFAULT 0 NOT NULL,
  "description" text,
  "is_password_protected" boolean DEFAULT false NOT NULL,
  "disqualify_reason" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "eu_tournament_teams_tournament_idx"
  ON "eu_tournament_teams" ("tournament_id");
CREATE INDEX IF NOT EXISTS "eu_tournament_teams_owner_idx"
  ON "eu_tournament_teams" ("owner_account_id");

-- The join onto everything else we hold. `nickname` is the name the account
-- carried when the roster was read, kept verbatim: players rename, and a bracket
-- from 2019 should read as it was played.
CREATE TABLE IF NOT EXISTS "eu_tournament_team_players" (
  "tournament_id" bigint NOT NULL,
  "team_id" bigint NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "role" text DEFAULT '' NOT NULL,
  CONSTRAINT "eu_tournament_team_players_team_id_account_id_pk"
    PRIMARY KEY ("team_id", "account_id")
);
CREATE INDEX IF NOT EXISTS "eu_tournament_team_players_account_idx"
  ON "eu_tournament_team_players" ("account_id");
CREATE INDEX IF NOT EXISTS "eu_tournament_team_players_tournament_idx"
  ON "eu_tournament_team_players" ("tournament_id");

-- A tournament's phases (a qualifier, a group stage, the playoffs).
CREATE TABLE IF NOT EXISTS "eu_tournament_stages" (
  "id" bigint PRIMARY KEY,
  "tournament_id" bigint NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "bracket_type" text NOT NULL,
  "draw_management" text NOT NULL,
  "winners_per_group" integer DEFAULT 1 NOT NULL,
  "groups_count" integer DEFAULT 0 NOT NULL,
  "start_at" timestamp with time zone,
  "end_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "eu_tournament_stages_tournament_idx"
  ON "eu_tournament_stages" ("tournament_id", "start_at");

-- One bracket inside a stage: a knockout holds its whole tree in a single group,
-- a group stage has one per pool.
CREATE TABLE IF NOT EXISTS "eu_tournament_groups" (
  "id" bigint PRIMARY KEY,
  "tournament_id" bigint NOT NULL,
  "stage_id" bigint NOT NULL,
  "order" integer DEFAULT 1 NOT NULL,
  "state" text NOT NULL,
  "teams_count" integer DEFAULT 0 NOT NULL,
  "winner_rounds" integer DEFAULT 0 NOT NULL,
  "looser_rounds" integer DEFAULT 0 NOT NULL
);
CREATE INDEX IF NOT EXISTS "eu_tournament_groups_stage_idx"
  ON "eu_tournament_groups" ("stage_id", "order");
CREATE INDEX IF NOT EXISTS "eu_tournament_groups_tournament_idx"
  ON "eu_tournament_groups" ("tournament_id");

-- One tie. The tree is threaded on `uuid` through `next_match_for_winner`, so a
-- match knows where its winner plays next. In a knockout, `round` counts from
-- the end (1 IS the final, -1 the third-place match); in a round robin it is the
-- plain matchday. Null scores mean unsettled, which is not 0-0.
CREATE TABLE IF NOT EXISTS "eu_tournament_matches" (
  "uuid" text NOT NULL,
  "tournament_id" bigint NOT NULL,
  "stage_id" bigint NOT NULL,
  "group_id" bigint NOT NULL,
  "state" text NOT NULL,
  "round" integer NOT NULL,
  "position" integer NOT NULL,
  "team_1_id" bigint,
  "team_2_id" bigint,
  "winner_team_id" bigint,
  "wins_team_1" integer,
  "wins_team_2" integer,
  "draws" integer,
  "maps" text,
  "start_at" timestamp with time zone,
  "next_match_for_winner" text,
  "next_match_for_looser" text,
  CONSTRAINT "eu_tournament_matches_tournament_id_uuid_pk"
    PRIMARY KEY ("tournament_id", "uuid")
);
CREATE INDEX IF NOT EXISTS "eu_tournament_matches_group_idx"
  ON "eu_tournament_matches" ("group_id", "round", "position");
CREATE INDEX IF NOT EXISTS "eu_tournament_matches_team1_idx"
  ON "eu_tournament_matches" ("team_1_id");
CREATE INDEX IF NOT EXISTS "eu_tournament_matches_team2_idx"
  ON "eu_tournament_matches" ("team_2_id");

-- Where a placement comes from: the match tree says who beat whom but never who
-- finished third. A round robin fills the counters in; a single elimination
-- records the placement and leaves them at zero, and its positions are not dense
-- (teams out in the same round share a rank: 1, 2, 4, 4, 8, 8, 8, 8). A double
-- elimination fills in neither, only the seeding, so its finishing order has to
-- be read off the match tree.
CREATE TABLE IF NOT EXISTS "eu_tournament_standings" (
  "tournament_id" bigint NOT NULL,
  "stage_id" bigint NOT NULL,
  "group_id" bigint NOT NULL,
  "team_id" bigint NOT NULL,
  "position" integer,
  "seed" integer,
  "wins" integer DEFAULT 0 NOT NULL,
  "losses" integer DEFAULT 0 NOT NULL,
  "draws" integer DEFAULT 0 NOT NULL,
  "battles_played" integer DEFAULT 0 NOT NULL,
  "tie_break_wins" integer DEFAULT 0 NOT NULL,
  "tie_break_losses" integer DEFAULT 0 NOT NULL,
  "points" integer,
  CONSTRAINT "eu_tournament_standings_group_id_team_id_pk"
    PRIMARY KEY ("group_id", "team_id")
);
CREATE INDEX IF NOT EXISTS "eu_tournament_standings_tournament_idx"
  ON "eu_tournament_standings" ("tournament_id", "position");
CREATE INDEX IF NOT EXISTS "eu_tournament_standings_team_idx"
  ON "eu_tournament_standings" ("team_id");


-- ---- NA ----

-- The catalogue row. `detail_synced_at` is null until the per-tournament fetch
-- has run, so it separates a tournament we merely listed from one we mirrored in
-- full, and it is what the backfill claims its next batch on.
CREATE TABLE IF NOT EXISTS "na_tournaments" (
  "id" bigint PRIMARY KEY,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "language" text DEFAULT 'en' NOT NULL,
  "status" text NOT NULL,
  "game_modes" text[] DEFAULT '{}' NOT NULL,
  "tier_from" integer,
  "tier_to" integer,
  "min_players_in_team" integer NOT NULL,
  "max_players_in_team" integer NOT NULL,
  "teams_limit" integer,
  "confirmed_teams" integer DEFAULT 0 NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "registration_from" timestamp with time zone,
  "registration_till" timestamp with time zone,
  "prize" text,
  "prize_tiers" jsonb,
  "rules" jsonb,
  "tags" jsonb,
  "logo_url" text,
  "is_featured" boolean DEFAULT false NOT NULL,
  "map_pool" text[],
  "bracket_types" text[],
  "total_level_from" integer,
  "total_level_to" integer,
  "schedule" jsonb,
  "detail_synced_at" timestamp with time zone,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "na_tournaments_status_start_idx"
  ON "na_tournaments" ("status", "start_at" DESC);
CREATE INDEX IF NOT EXISTS "na_tournaments_start_idx"
  ON "na_tournaments" ("start_at" DESC);
CREATE INDEX IF NOT EXISTS "na_tournaments_detail_sync_idx"
  ON "na_tournaments" ("detail_synced_at");

-- One entry in a tournament. Teams are formed per tournament, not persistent:
-- the same five players enter next week's under a new name and a new id.
CREATE TABLE IF NOT EXISTS "na_tournament_teams" (
  "id" bigint PRIMARY KEY,
  "tournament_id" bigint NOT NULL,
  "title" text NOT NULL,
  "status" text NOT NULL,
  "owner_account_id" bigint,
  "players_count" integer DEFAULT 0 NOT NULL,
  "max_players" integer DEFAULT 0 NOT NULL,
  "description" text,
  "is_password_protected" boolean DEFAULT false NOT NULL,
  "disqualify_reason" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "na_tournament_teams_tournament_idx"
  ON "na_tournament_teams" ("tournament_id");
CREATE INDEX IF NOT EXISTS "na_tournament_teams_owner_idx"
  ON "na_tournament_teams" ("owner_account_id");

-- The join onto everything else we hold. `nickname` is the name the account
-- carried when the roster was read, kept verbatim: players rename, and a bracket
-- from 2019 should read as it was played.
CREATE TABLE IF NOT EXISTS "na_tournament_team_players" (
  "tournament_id" bigint NOT NULL,
  "team_id" bigint NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "role" text DEFAULT '' NOT NULL,
  CONSTRAINT "na_tournament_team_players_team_id_account_id_pk"
    PRIMARY KEY ("team_id", "account_id")
);
CREATE INDEX IF NOT EXISTS "na_tournament_team_players_account_idx"
  ON "na_tournament_team_players" ("account_id");
CREATE INDEX IF NOT EXISTS "na_tournament_team_players_tournament_idx"
  ON "na_tournament_team_players" ("tournament_id");

-- A tournament's phases (a qualifier, a group stage, the playoffs).
CREATE TABLE IF NOT EXISTS "na_tournament_stages" (
  "id" bigint PRIMARY KEY,
  "tournament_id" bigint NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "bracket_type" text NOT NULL,
  "draw_management" text NOT NULL,
  "winners_per_group" integer DEFAULT 1 NOT NULL,
  "groups_count" integer DEFAULT 0 NOT NULL,
  "start_at" timestamp with time zone,
  "end_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "na_tournament_stages_tournament_idx"
  ON "na_tournament_stages" ("tournament_id", "start_at");

-- One bracket inside a stage: a knockout holds its whole tree in a single group,
-- a group stage has one per pool.
CREATE TABLE IF NOT EXISTS "na_tournament_groups" (
  "id" bigint PRIMARY KEY,
  "tournament_id" bigint NOT NULL,
  "stage_id" bigint NOT NULL,
  "order" integer DEFAULT 1 NOT NULL,
  "state" text NOT NULL,
  "teams_count" integer DEFAULT 0 NOT NULL,
  "winner_rounds" integer DEFAULT 0 NOT NULL,
  "looser_rounds" integer DEFAULT 0 NOT NULL
);
CREATE INDEX IF NOT EXISTS "na_tournament_groups_stage_idx"
  ON "na_tournament_groups" ("stage_id", "order");
CREATE INDEX IF NOT EXISTS "na_tournament_groups_tournament_idx"
  ON "na_tournament_groups" ("tournament_id");

-- One tie. The tree is threaded on `uuid` through `next_match_for_winner`, so a
-- match knows where its winner plays next. In a knockout, `round` counts from
-- the end (1 IS the final, -1 the third-place match); in a round robin it is the
-- plain matchday. Null scores mean unsettled, which is not 0-0.
CREATE TABLE IF NOT EXISTS "na_tournament_matches" (
  "uuid" text NOT NULL,
  "tournament_id" bigint NOT NULL,
  "stage_id" bigint NOT NULL,
  "group_id" bigint NOT NULL,
  "state" text NOT NULL,
  "round" integer NOT NULL,
  "position" integer NOT NULL,
  "team_1_id" bigint,
  "team_2_id" bigint,
  "winner_team_id" bigint,
  "wins_team_1" integer,
  "wins_team_2" integer,
  "draws" integer,
  "maps" text,
  "start_at" timestamp with time zone,
  "next_match_for_winner" text,
  "next_match_for_looser" text,
  CONSTRAINT "na_tournament_matches_tournament_id_uuid_pk"
    PRIMARY KEY ("tournament_id", "uuid")
);
CREATE INDEX IF NOT EXISTS "na_tournament_matches_group_idx"
  ON "na_tournament_matches" ("group_id", "round", "position");
CREATE INDEX IF NOT EXISTS "na_tournament_matches_team1_idx"
  ON "na_tournament_matches" ("team_1_id");
CREATE INDEX IF NOT EXISTS "na_tournament_matches_team2_idx"
  ON "na_tournament_matches" ("team_2_id");

-- Where a placement comes from: the match tree says who beat whom but never who
-- finished third. A round robin fills the counters in; a single elimination
-- records the placement and leaves them at zero, and its positions are not dense
-- (teams out in the same round share a rank: 1, 2, 4, 4, 8, 8, 8, 8). A double
-- elimination fills in neither, only the seeding, so its finishing order has to
-- be read off the match tree.
CREATE TABLE IF NOT EXISTS "na_tournament_standings" (
  "tournament_id" bigint NOT NULL,
  "stage_id" bigint NOT NULL,
  "group_id" bigint NOT NULL,
  "team_id" bigint NOT NULL,
  "position" integer,
  "seed" integer,
  "wins" integer DEFAULT 0 NOT NULL,
  "losses" integer DEFAULT 0 NOT NULL,
  "draws" integer DEFAULT 0 NOT NULL,
  "battles_played" integer DEFAULT 0 NOT NULL,
  "tie_break_wins" integer DEFAULT 0 NOT NULL,
  "tie_break_losses" integer DEFAULT 0 NOT NULL,
  "points" integer,
  CONSTRAINT "na_tournament_standings_group_id_team_id_pk"
    PRIMARY KEY ("group_id", "team_id")
);
CREATE INDEX IF NOT EXISTS "na_tournament_standings_tournament_idx"
  ON "na_tournament_standings" ("tournament_id", "position");
CREATE INDEX IF NOT EXISTS "na_tournament_standings_team_idx"
  ON "na_tournament_standings" ("team_id");


-- ---- ASIA ----

-- The catalogue row. `detail_synced_at` is null until the per-tournament fetch
-- has run, so it separates a tournament we merely listed from one we mirrored in
-- full, and it is what the backfill claims its next batch on.
CREATE TABLE IF NOT EXISTS "asia_tournaments" (
  "id" bigint PRIMARY KEY,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "language" text DEFAULT 'en' NOT NULL,
  "status" text NOT NULL,
  "game_modes" text[] DEFAULT '{}' NOT NULL,
  "tier_from" integer,
  "tier_to" integer,
  "min_players_in_team" integer NOT NULL,
  "max_players_in_team" integer NOT NULL,
  "teams_limit" integer,
  "confirmed_teams" integer DEFAULT 0 NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "registration_from" timestamp with time zone,
  "registration_till" timestamp with time zone,
  "prize" text,
  "prize_tiers" jsonb,
  "rules" jsonb,
  "tags" jsonb,
  "logo_url" text,
  "is_featured" boolean DEFAULT false NOT NULL,
  "map_pool" text[],
  "bracket_types" text[],
  "total_level_from" integer,
  "total_level_to" integer,
  "schedule" jsonb,
  "detail_synced_at" timestamp with time zone,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "asia_tournaments_status_start_idx"
  ON "asia_tournaments" ("status", "start_at" DESC);
CREATE INDEX IF NOT EXISTS "asia_tournaments_start_idx"
  ON "asia_tournaments" ("start_at" DESC);
CREATE INDEX IF NOT EXISTS "asia_tournaments_detail_sync_idx"
  ON "asia_tournaments" ("detail_synced_at");

-- One entry in a tournament. Teams are formed per tournament, not persistent:
-- the same five players enter next week's under a new name and a new id.
CREATE TABLE IF NOT EXISTS "asia_tournament_teams" (
  "id" bigint PRIMARY KEY,
  "tournament_id" bigint NOT NULL,
  "title" text NOT NULL,
  "status" text NOT NULL,
  "owner_account_id" bigint,
  "players_count" integer DEFAULT 0 NOT NULL,
  "max_players" integer DEFAULT 0 NOT NULL,
  "description" text,
  "is_password_protected" boolean DEFAULT false NOT NULL,
  "disqualify_reason" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "asia_tournament_teams_tournament_idx"
  ON "asia_tournament_teams" ("tournament_id");
CREATE INDEX IF NOT EXISTS "asia_tournament_teams_owner_idx"
  ON "asia_tournament_teams" ("owner_account_id");

-- The join onto everything else we hold. `nickname` is the name the account
-- carried when the roster was read, kept verbatim: players rename, and a bracket
-- from 2019 should read as it was played.
CREATE TABLE IF NOT EXISTS "asia_tournament_team_players" (
  "tournament_id" bigint NOT NULL,
  "team_id" bigint NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "role" text DEFAULT '' NOT NULL,
  CONSTRAINT "asia_tournament_team_players_team_id_account_id_pk"
    PRIMARY KEY ("team_id", "account_id")
);
CREATE INDEX IF NOT EXISTS "asia_tournament_team_players_account_idx"
  ON "asia_tournament_team_players" ("account_id");
CREATE INDEX IF NOT EXISTS "asia_tournament_team_players_tournament_idx"
  ON "asia_tournament_team_players" ("tournament_id");

-- A tournament's phases (a qualifier, a group stage, the playoffs).
CREATE TABLE IF NOT EXISTS "asia_tournament_stages" (
  "id" bigint PRIMARY KEY,
  "tournament_id" bigint NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "bracket_type" text NOT NULL,
  "draw_management" text NOT NULL,
  "winners_per_group" integer DEFAULT 1 NOT NULL,
  "groups_count" integer DEFAULT 0 NOT NULL,
  "start_at" timestamp with time zone,
  "end_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "asia_tournament_stages_tournament_idx"
  ON "asia_tournament_stages" ("tournament_id", "start_at");

-- One bracket inside a stage: a knockout holds its whole tree in a single group,
-- a group stage has one per pool.
CREATE TABLE IF NOT EXISTS "asia_tournament_groups" (
  "id" bigint PRIMARY KEY,
  "tournament_id" bigint NOT NULL,
  "stage_id" bigint NOT NULL,
  "order" integer DEFAULT 1 NOT NULL,
  "state" text NOT NULL,
  "teams_count" integer DEFAULT 0 NOT NULL,
  "winner_rounds" integer DEFAULT 0 NOT NULL,
  "looser_rounds" integer DEFAULT 0 NOT NULL
);
CREATE INDEX IF NOT EXISTS "asia_tournament_groups_stage_idx"
  ON "asia_tournament_groups" ("stage_id", "order");
CREATE INDEX IF NOT EXISTS "asia_tournament_groups_tournament_idx"
  ON "asia_tournament_groups" ("tournament_id");

-- One tie. The tree is threaded on `uuid` through `next_match_for_winner`, so a
-- match knows where its winner plays next. In a knockout, `round` counts from
-- the end (1 IS the final, -1 the third-place match); in a round robin it is the
-- plain matchday. Null scores mean unsettled, which is not 0-0.
CREATE TABLE IF NOT EXISTS "asia_tournament_matches" (
  "uuid" text NOT NULL,
  "tournament_id" bigint NOT NULL,
  "stage_id" bigint NOT NULL,
  "group_id" bigint NOT NULL,
  "state" text NOT NULL,
  "round" integer NOT NULL,
  "position" integer NOT NULL,
  "team_1_id" bigint,
  "team_2_id" bigint,
  "winner_team_id" bigint,
  "wins_team_1" integer,
  "wins_team_2" integer,
  "draws" integer,
  "maps" text,
  "start_at" timestamp with time zone,
  "next_match_for_winner" text,
  "next_match_for_looser" text,
  CONSTRAINT "asia_tournament_matches_tournament_id_uuid_pk"
    PRIMARY KEY ("tournament_id", "uuid")
);
CREATE INDEX IF NOT EXISTS "asia_tournament_matches_group_idx"
  ON "asia_tournament_matches" ("group_id", "round", "position");
CREATE INDEX IF NOT EXISTS "asia_tournament_matches_team1_idx"
  ON "asia_tournament_matches" ("team_1_id");
CREATE INDEX IF NOT EXISTS "asia_tournament_matches_team2_idx"
  ON "asia_tournament_matches" ("team_2_id");

-- Where a placement comes from: the match tree says who beat whom but never who
-- finished third. A round robin fills the counters in; a single elimination
-- records the placement and leaves them at zero, and its positions are not dense
-- (teams out in the same round share a rank: 1, 2, 4, 4, 8, 8, 8, 8). A double
-- elimination fills in neither, only the seeding, so its finishing order has to
-- be read off the match tree.
CREATE TABLE IF NOT EXISTS "asia_tournament_standings" (
  "tournament_id" bigint NOT NULL,
  "stage_id" bigint NOT NULL,
  "group_id" bigint NOT NULL,
  "team_id" bigint NOT NULL,
  "position" integer,
  "seed" integer,
  "wins" integer DEFAULT 0 NOT NULL,
  "losses" integer DEFAULT 0 NOT NULL,
  "draws" integer DEFAULT 0 NOT NULL,
  "battles_played" integer DEFAULT 0 NOT NULL,
  "tie_break_wins" integer DEFAULT 0 NOT NULL,
  "tie_break_losses" integer DEFAULT 0 NOT NULL,
  "points" integer,
  CONSTRAINT "asia_tournament_standings_group_id_team_id_pk"
    PRIMARY KEY ("group_id", "team_id")
);
CREATE INDEX IF NOT EXISTS "asia_tournament_standings_tournament_idx"
  ON "asia_tournament_standings" ("tournament_id", "position");
CREATE INDEX IF NOT EXISTS "asia_tournament_standings_team_idx"
  ON "asia_tournament_standings" ("team_id");
