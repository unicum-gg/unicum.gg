-- Per-region community roll-up of per-tank stats, one row per tank. Populated
-- by the tank-aggregates cron (nightly) from the latest snapshot per
-- (player, tank) in <region>_tank_snapshots, then read as a single row by the
-- <region>/tanks/[id] page so a tank pageview never touches the snapshot table.
--
-- Hand-written, NOT generated: the makeXxxTable(region) factory is invisible
-- to drizzle-kit's AST analyzer, so `db:generate`/`db:push` would propose
-- DROP CASCADE on every per-region table. See AGENTS.md "Database migrations".
-- Plain CREATE TABLE so this can run inside the migrate transaction; idempotent
-- via IF NOT EXISTS. Apply with `psql "$DATABASE_URL" -f drizzle/0012_*.sql`.

CREATE TABLE IF NOT EXISTS "eu_tank_aggregates" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "players" integer NOT NULL,
  "battles" bigint NOT NULL,
  "wins" bigint NOT NULL,
  "damage_dealt" bigint NOT NULL,
  "frags" bigint NOT NULL,
  "spotted" bigint NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "na_tank_aggregates" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "players" integer NOT NULL,
  "battles" bigint NOT NULL,
  "wins" bigint NOT NULL,
  "damage_dealt" bigint NOT NULL,
  "frags" bigint NOT NULL,
  "spotted" bigint NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asia_tank_aggregates" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "players" integer NOT NULL,
  "battles" bigint NOT NULL,
  "wins" bigint NOT NULL,
  "damage_dealt" bigint NOT NULL,
  "frags" bigint NOT NULL,
  "spotted" bigint NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
