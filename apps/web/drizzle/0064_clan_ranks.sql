-- Materialised leaderboard rank, for the clan badges ("#1 Skirmish X",
-- "Top 1% WNX") shown next to a clan tag.
--
-- Written by hand, not by `drizzle-kit generate`: the schema uses the
-- `makeXxxTable(region)` factory pattern, which drizzle-kit's AST analyser
-- cannot see into and would answer with `DROP TABLE ... CASCADE` on every
-- per-region table. See AGENTS.md.
--
-- Why a column rather than ranking at read time: `rank() over (order by
-- avg_value desc)` costs a full sort of the board. Measured on EU, 410 ms for a
-- single clan on `clan_ratings` (16.5k rows x 3 metrics), and a leaderboard page
-- would pay the same sort again for every row on it. Both tables are already
-- rebuilt hourly by the top-clans cron, so the rank is free to compute exactly
-- where the ordering is already known, and the read becomes an indexed lookup.
--
-- Nullable: rows written before the cron next runs simply have no rank yet, and
-- a clan with no rank shows no badge, which is the correct default anyway.

ALTER TABLE "eu_clan_ratings"    ADD COLUMN IF NOT EXISTS "rank" integer;
ALTER TABLE "na_clan_ratings"    ADD COLUMN IF NOT EXISTS "rank" integer;
ALTER TABLE "asia_clan_ratings"  ADD COLUMN IF NOT EXISTS "rank" integer;

ALTER TABLE "eu_stronghold_ratings"   ADD COLUMN IF NOT EXISTS "rank" integer;
ALTER TABLE "na_stronghold_ratings"   ADD COLUMN IF NOT EXISTS "rank" integer;
ALTER TABLE "asia_stronghold_ratings" ADD COLUMN IF NOT EXISTS "rank" integer;

-- The badge lookup is "this clan's rank on every board", so the useful index is
-- by clan, not by rank. `clan_ratings` is keyed (metric, clan_id) and
-- `stronghold_ratings` (tier, period, clan_id), neither of which can serve a
-- clan-only lookup, hence one index each.
CREATE INDEX IF NOT EXISTS "eu_clan_ratings_clan_idx"
  ON "eu_clan_ratings" ("clan_id");
CREATE INDEX IF NOT EXISTS "na_clan_ratings_clan_idx"
  ON "na_clan_ratings" ("clan_id");
CREATE INDEX IF NOT EXISTS "asia_clan_ratings_clan_idx"
  ON "asia_clan_ratings" ("clan_id");

CREATE INDEX IF NOT EXISTS "eu_stronghold_ratings_clan_idx"
  ON "eu_stronghold_ratings" ("clan_id");
CREATE INDEX IF NOT EXISTS "na_stronghold_ratings_clan_idx"
  ON "na_stronghold_ratings" ("clan_id");
CREATE INDEX IF NOT EXISTS "asia_stronghold_ratings_clan_idx"
  ON "asia_stronghold_ratings" ("clan_id");
