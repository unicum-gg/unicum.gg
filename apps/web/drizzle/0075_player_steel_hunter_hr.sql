-- Steel Hunter (battle-royale) leaderboard: the HR rating + the raw Steel
-- Hunter totals, cached on the players row by the snapshot-cron from the latest
-- `fallout_*` snapshot (WG's repurposed Steel Hunter block).
--
-- Mirrors the wnx/battles caching: keeping these on the row lets the Steel
-- Hunter board rank by a cached column (WHERE sh_battles >= 100 ORDER BY hr
-- DESC) instead of a DISTINCT-ON scan of the ~hundreds-of-millions-row
-- player_snapshots table. `hr` is computeHR(); the totals ride along so the
-- board renders winrate / survival / avg damage without a snapshots join.
--
-- Written by hand: `drizzle-kit` cannot see tables built by a
-- `makeXxxTable(region)` factory (see AGENTS.md) — it would emit DROP TABLE for
-- every per-region table. `ADD COLUMN` with no default rewrites nothing in
-- Postgres 11+; the partial index is built CONCURRENTLY so it never blocks the
-- snapshot-cron's writes.
ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "hr" real;
ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "sh_battles" integer;
ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "sh_wins" integer;
ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "sh_survived" integer;
ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "sh_damage" bigint;
ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "sh_frags" integer;

ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "hr" real;
ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "sh_battles" integer;
ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "sh_wins" integer;
ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "sh_survived" integer;
ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "sh_damage" bigint;
ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "sh_frags" integer;

ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "hr" real;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "sh_battles" integer;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "sh_wins" integer;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "sh_survived" integer;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "sh_damage" bigint;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "sh_frags" integer;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "eu_players_hr_idx"   ON "eu_players"   ("hr" DESC NULLS LAST) WHERE "sh_battles" >= 100;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "na_players_hr_idx"   ON "na_players"   ("hr" DESC NULLS LAST) WHERE "sh_battles" >= 100;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "asia_players_hr_idx" ON "asia_players" ("hr" DESC NULLS LAST) WHERE "sh_battles" >= 100;
