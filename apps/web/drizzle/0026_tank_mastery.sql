-- Per-region Mark of Mastery XP thresholds (one table per region). The badge
-- boundaries are server-specific (WG recomputes them per region as percentiles
-- of per-battle XP), so unlike tank_specs they cannot be global. Mirrored daily
-- from the poliroid aggregate by the mastery cron; read by the /[region]/tanks
-- Marks of Mastery table. Hand-written: the makeXxxTable(region) factory hides
-- these from drizzle-kit, so db:generate never emits them.
CREATE TABLE "eu_tank_mastery" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "class3" integer NOT NULL,
  "class2" integer NOT NULL,
  "class1" integer NOT NULL,
  "ace" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "na_tank_mastery" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "class3" integer NOT NULL,
  "class2" integer NOT NULL,
  "class1" integer NOT NULL,
  "ace" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "asia_tank_mastery" (
  "tank_id" integer PRIMARY KEY NOT NULL,
  "class3" integer NOT NULL,
  "class2" integer NOT NULL,
  "class1" integer NOT NULL,
  "ace" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
