-- Per-player medal cabinet: how many times each Wargaming achievement was
-- earned, one row per player.
--
-- Written by hand, not by `drizzle-kit generate`. The schema uses the
-- `makeXxxTable(region)` factory pattern, which drizzle-kit's AST analyser
-- cannot see into: it concludes every `eu_*`/`na_*`/`asia_*` table is orphaned
-- and emits `DROP TABLE ... CASCADE` for all of them. See AGENTS.md.
--
-- Shape: the counts live in one `jsonb` map keyed by Wargaming's own
-- achievement ids, rather than a row per (player, medal). The grid is always
-- read whole for a single player, and a relational shape would be ~260M rows
-- (2M players x ~126 earned medals) to answer a query that never needs them
-- individually. `earned` is denormalised out of the map so cabinet-size
-- leaderboards and rarity aggregates stay index scans.

CREATE TABLE IF NOT EXISTS "eu_player_achievements" (
  "player_id" integer PRIMARY KEY NOT NULL
    REFERENCES "eu_players"("id") ON DELETE CASCADE,
  "counts" jsonb NOT NULL,
  "earned" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "na_player_achievements" (
  "player_id" integer PRIMARY KEY NOT NULL
    REFERENCES "na_players"("id") ON DELETE CASCADE,
  "counts" jsonb NOT NULL,
  "earned" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "asia_player_achievements" (
  "player_id" integer PRIMARY KEY NOT NULL
    REFERENCES "asia_players"("id") ON DELETE CASCADE,
  "counts" jsonb NOT NULL,
  "earned" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "eu_player_achievements_earned_idx"
  ON "eu_player_achievements" ("earned");
CREATE INDEX IF NOT EXISTS "na_player_achievements_earned_idx"
  ON "na_player_achievements" ("earned");
CREATE INDEX IF NOT EXISTS "asia_player_achievements_earned_idx"
  ON "asia_player_achievements" ("earned");

CREATE INDEX IF NOT EXISTS "eu_player_achievements_updated_idx"
  ON "eu_player_achievements" ("updated_at");
CREATE INDEX IF NOT EXISTS "na_player_achievements_updated_idx"
  ON "na_player_achievements" ("updated_at");
CREATE INDEX IF NOT EXISTS "asia_player_achievements_updated_idx"
  ON "asia_player_achievements" ("updated_at");
