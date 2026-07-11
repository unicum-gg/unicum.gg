-- Per-region Marks of Excellence combined-damage thresholds (one table per
-- region). Like tank_mastery, the mark boundaries are server-specific (WG
-- recomputes them per region as percentiles of combined damage over 14 days),
-- so they cannot be global. Mirrored daily from the poliroid gunmarks aggregate
-- by the moe cron; read by the /[region]/tanks Marks of Excellence table.
-- Hand-written: the makeXxxTable(region) factory hides these from drizzle-kit.
CREATE TABLE "eu_tank_moe" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "mark1" integer NOT NULL,
  "mark2" integer NOT NULL,
  "mark3" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "na_tank_moe" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "mark1" integer NOT NULL,
  "mark2" integer NOT NULL,
  "mark3" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "asia_tank_moe" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "mark1" integer NOT NULL,
  "mark2" integer NOT NULL,
  "mark3" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
