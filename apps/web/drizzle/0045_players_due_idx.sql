-- Snapshot-pipeline due-player claim index.
--
-- The claim (see players/backfill-cron.ts) selects the top-N due players ordered
-- by (last_battle_at DESC NULLS FIRST, last_seen_at ASC). Without a matching
-- index that is a full seq scan of the ~2M-row per-region players table plus a
-- top-N sort on every claim — which pegged Postgres CPU. This index lets Postgres
-- walk in priority order and stop at the LIMIT (index scan, ~5x faster, no sort).
--
-- CONCURRENTLY so it never locks the live table; IF NOT EXISTS so re-running is a
-- no-op (these were already created concurrently on prod).
CREATE INDEX CONCURRENTLY IF NOT EXISTS eu_players_due_idx
  ON eu_players (last_battle_at DESC NULLS FIRST, last_seen_at ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS na_players_due_idx
  ON na_players (last_battle_at DESC NULLS FIRST, last_seen_at ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS asia_players_due_idx
  ON asia_players (last_battle_at DESC NULLS FIRST, last_seen_at ASC);
