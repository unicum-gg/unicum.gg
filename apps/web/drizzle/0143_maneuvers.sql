-- Maneuvers: the recurring Stronghold clan event, one set of tables per region.
--
-- Written by hand rather than generated: drizzle-kit cannot diff these without
-- an interactive prompt, because the per-region factory makes every new table
-- look like a possible rename of an existing one. AGENTS.md says to write the
-- migration by hand in exactly that case.

CREATE TABLE IF NOT EXISTS "eu_maneuvers_editions" (
	"event_name" text PRIMARY KEY NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"vehicle_levels" integer[],
	"tank_reward_positions" integer,
	"clan_gold_positions" integer,
	"account_bonds_percent" integer,
	"clan_bonds_percent" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eu_maneuvers_players" (
	"event_name" text NOT NULL,
	"account_id" bigint NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"nickname" text,
	"clan_id" bigint,
	"clan_tag" text,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eu_maneuvers_players_pk" PRIMARY KEY("event_name","account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eu_maneuvers_player_history" (
	"event_name" text NOT NULL,
	"account_id" bigint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "eu_maneuvers_player_history_pk" PRIMARY KEY("event_name","account_id","captured_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eu_maneuvers_clans" (
	"event_name" text NOT NULL,
	"clan_id" bigint NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"tag" text,
	"name" text,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eu_maneuvers_clans_pk" PRIMARY KEY("event_name","clan_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eu_maneuvers_clan_history" (
	"event_name" text NOT NULL,
	"clan_id" bigint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "eu_maneuvers_clan_history_pk" PRIMARY KEY("event_name","clan_id","captured_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eu_maneuvers_snapshots" (
	"event_name" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"player_count" integer NOT NULL,
	"player_unfiltered_count" integer,
	"clan_count" integer NOT NULL,
	"clan_unfiltered_count" integer,
	"tank_cutoff_points" bigint,
	"clan_gold_cutoff_points" bigint,
	"top_player_points" bigint,
	"top_clan_points" bigint,
	"total_fame_points" bigint,
	CONSTRAINT "eu_maneuvers_snapshots_pk" PRIMARY KEY("event_name","captured_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "na_maneuvers_editions" (
	"event_name" text PRIMARY KEY NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"vehicle_levels" integer[],
	"tank_reward_positions" integer,
	"clan_gold_positions" integer,
	"account_bonds_percent" integer,
	"clan_bonds_percent" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "na_maneuvers_players" (
	"event_name" text NOT NULL,
	"account_id" bigint NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"nickname" text,
	"clan_id" bigint,
	"clan_tag" text,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "na_maneuvers_players_pk" PRIMARY KEY("event_name","account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "na_maneuvers_player_history" (
	"event_name" text NOT NULL,
	"account_id" bigint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "na_maneuvers_player_history_pk" PRIMARY KEY("event_name","account_id","captured_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "na_maneuvers_clans" (
	"event_name" text NOT NULL,
	"clan_id" bigint NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"tag" text,
	"name" text,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "na_maneuvers_clans_pk" PRIMARY KEY("event_name","clan_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "na_maneuvers_clan_history" (
	"event_name" text NOT NULL,
	"clan_id" bigint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "na_maneuvers_clan_history_pk" PRIMARY KEY("event_name","clan_id","captured_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "na_maneuvers_snapshots" (
	"event_name" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"player_count" integer NOT NULL,
	"player_unfiltered_count" integer,
	"clan_count" integer NOT NULL,
	"clan_unfiltered_count" integer,
	"tank_cutoff_points" bigint,
	"clan_gold_cutoff_points" bigint,
	"top_player_points" bigint,
	"top_clan_points" bigint,
	"total_fame_points" bigint,
	CONSTRAINT "na_maneuvers_snapshots_pk" PRIMARY KEY("event_name","captured_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asia_maneuvers_editions" (
	"event_name" text PRIMARY KEY NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"vehicle_levels" integer[],
	"tank_reward_positions" integer,
	"clan_gold_positions" integer,
	"account_bonds_percent" integer,
	"clan_bonds_percent" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asia_maneuvers_players" (
	"event_name" text NOT NULL,
	"account_id" bigint NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"nickname" text,
	"clan_id" bigint,
	"clan_tag" text,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asia_maneuvers_players_pk" PRIMARY KEY("event_name","account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asia_maneuvers_player_history" (
	"event_name" text NOT NULL,
	"account_id" bigint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "asia_maneuvers_player_history_pk" PRIMARY KEY("event_name","account_id","captured_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asia_maneuvers_clans" (
	"event_name" text NOT NULL,
	"clan_id" bigint NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"tag" text,
	"name" text,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asia_maneuvers_clans_pk" PRIMARY KEY("event_name","clan_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asia_maneuvers_clan_history" (
	"event_name" text NOT NULL,
	"clan_id" bigint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"place" integer NOT NULL,
	"fame_points" bigint NOT NULL,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "asia_maneuvers_clan_history_pk" PRIMARY KEY("event_name","clan_id","captured_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asia_maneuvers_snapshots" (
	"event_name" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"player_count" integer NOT NULL,
	"player_unfiltered_count" integer,
	"clan_count" integer NOT NULL,
	"clan_unfiltered_count" integer,
	"tank_cutoff_points" bigint,
	"clan_gold_cutoff_points" bigint,
	"top_player_points" bigint,
	"top_clan_points" bigint,
	"total_fame_points" bigint,
	CONSTRAINT "asia_maneuvers_snapshots_pk" PRIMARY KEY("event_name","captured_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_maneuvers_players_event_place_idx" ON "eu_maneuvers_players" USING btree ("event_name","place");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_maneuvers_players_account_idx" ON "eu_maneuvers_players" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_maneuvers_players_clan_idx" ON "eu_maneuvers_players" USING btree ("event_name","clan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_maneuvers_player_history_account_idx" ON "eu_maneuvers_player_history" USING btree ("account_id","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_maneuvers_clans_event_place_idx" ON "eu_maneuvers_clans" USING btree ("event_name","place");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_maneuvers_clans_clan_idx" ON "eu_maneuvers_clans" USING btree ("clan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_maneuvers_clan_history_clan_idx" ON "eu_maneuvers_clan_history" USING btree ("clan_id","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_maneuvers_snapshots_event_idx" ON "eu_maneuvers_snapshots" USING btree ("event_name","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "na_maneuvers_players_event_place_idx" ON "na_maneuvers_players" USING btree ("event_name","place");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "na_maneuvers_players_account_idx" ON "na_maneuvers_players" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "na_maneuvers_players_clan_idx" ON "na_maneuvers_players" USING btree ("event_name","clan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "na_maneuvers_player_history_account_idx" ON "na_maneuvers_player_history" USING btree ("account_id","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "na_maneuvers_clans_event_place_idx" ON "na_maneuvers_clans" USING btree ("event_name","place");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "na_maneuvers_clans_clan_idx" ON "na_maneuvers_clans" USING btree ("clan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "na_maneuvers_clan_history_clan_idx" ON "na_maneuvers_clan_history" USING btree ("clan_id","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "na_maneuvers_snapshots_event_idx" ON "na_maneuvers_snapshots" USING btree ("event_name","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asia_maneuvers_players_event_place_idx" ON "asia_maneuvers_players" USING btree ("event_name","place");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asia_maneuvers_players_account_idx" ON "asia_maneuvers_players" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asia_maneuvers_players_clan_idx" ON "asia_maneuvers_players" USING btree ("event_name","clan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asia_maneuvers_player_history_account_idx" ON "asia_maneuvers_player_history" USING btree ("account_id","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asia_maneuvers_clans_event_place_idx" ON "asia_maneuvers_clans" USING btree ("event_name","place");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asia_maneuvers_clans_clan_idx" ON "asia_maneuvers_clans" USING btree ("clan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asia_maneuvers_clan_history_clan_idx" ON "asia_maneuvers_clan_history" USING btree ("clan_id","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asia_maneuvers_snapshots_event_idx" ON "asia_maneuvers_snapshots" USING btree ("event_name","captured_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maneuvers_tokens" (
	"region" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"account_id" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
