-- Per-tank leaderboard tables (one per region). Precomputed nightly by the
-- top-players-by-tank cron; read by the /[region]/tanks/[slug] page.
CREATE TABLE "eu_top_players_by_tank" (
  "tank_id" bigint NOT NULL,
  "metric" text NOT NULL,
  "rank" integer NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "clan_tag" text,
  "clan_color" text,
  "battles" integer NOT NULL,
  "avg_damage" real NOT NULL,
  "winrate" real NOT NULL,
  "value" numeric NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "eu_top_players_by_tank_pkey" PRIMARY KEY ("tank_id", "metric", "rank")
);--> statement-breakpoint
CREATE TABLE "na_top_players_by_tank" (
  "tank_id" bigint NOT NULL,
  "metric" text NOT NULL,
  "rank" integer NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "clan_tag" text,
  "clan_color" text,
  "battles" integer NOT NULL,
  "avg_damage" real NOT NULL,
  "winrate" real NOT NULL,
  "value" numeric NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "na_top_players_by_tank_pkey" PRIMARY KEY ("tank_id", "metric", "rank")
);--> statement-breakpoint
CREATE TABLE "asia_top_players_by_tank" (
  "tank_id" bigint NOT NULL,
  "metric" text NOT NULL,
  "rank" integer NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "clan_tag" text,
  "clan_color" text,
  "battles" integer NOT NULL,
  "avg_damage" real NOT NULL,
  "winrate" real NOT NULL,
  "value" numeric NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "asia_top_players_by_tank_pkey" PRIMARY KEY ("tank_id", "metric", "rank")
);
