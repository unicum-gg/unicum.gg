-- Per-tank server-wide averages (one table per region). Precomputed nightly by
-- the top-players-by-tank cron; read by the /[region]/tanks/[slug] page.
CREATE TABLE "eu_tank_stats" (
  "tank_id" bigint PRIMARY KEY NOT NULL,
  "players" integer NOT NULL,
  "avg_battles" real NOT NULL,
  "avg_damage" real NOT NULL,
  "winrate" real NOT NULL,
  "wn7" numeric,
  "wn8" numeric,
  "wnx" numeric,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "na_tank_stats" (
  "tank_id" bigint PRIMARY KEY NOT NULL,
  "players" integer NOT NULL,
  "avg_battles" real NOT NULL,
  "avg_damage" real NOT NULL,
  "winrate" real NOT NULL,
  "wn7" numeric,
  "wn8" numeric,
  "wnx" numeric,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "asia_tank_stats" (
  "tank_id" bigint PRIMARY KEY NOT NULL,
  "players" integer NOT NULL,
  "avg_battles" real NOT NULL,
  "avg_damage" real NOT NULL,
  "winrate" real NOT NULL,
  "wn7" numeric,
  "wn8" numeric,
  "wnx" numeric,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
