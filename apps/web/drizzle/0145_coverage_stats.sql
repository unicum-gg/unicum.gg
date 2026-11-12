-- Materialized /coverage payload, one singleton row per region.
--
-- Written by hand rather than by drizzle-kit: these tables come from a
-- `makeCoverageStatsTable(region)` factory, and the generator's AST pass only
-- sees top-level `pgTable(...)` exports, so it reads every per-region table as
-- an orphan and emits DROP TABLE for all of them.
--
-- Additive and idempotent: it creates three tables and touches nothing else, so
-- it is safe to apply before the deploy that reads them.

CREATE TABLE IF NOT EXISTS "eu_coverage_stats" (
  "id" smallint PRIMARY KEY DEFAULT 1,
  "payload" jsonb NOT NULL,
  "computed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "refresh_started_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "na_coverage_stats" (
  "id" smallint PRIMARY KEY DEFAULT 1,
  "payload" jsonb NOT NULL,
  "computed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "refresh_started_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "asia_coverage_stats" (
  "id" smallint PRIMARY KEY DEFAULT 1,
  "payload" jsonb NOT NULL,
  "computed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "refresh_started_at" timestamp with time zone
);
