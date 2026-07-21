-- Snapshot-pipeline backlog-claim index.
--
-- The pipeline runs two claim orderings (see players/snapshot-pipeline.ts,
-- ClaimMode): active workers order by (last_battle_at DESC, last_seen_at ASC)
-- and use the existing *_players_due_idx; backlog workers order by last_seen_at
-- ASC alone (longest-overdue first) to drain the recent90d/dormant backlog the
-- active ordering perpetually deprioritises. The due_idx can't serve that sort
-- (its leading column is last_battle_at), so without this index the backlog
-- claim top-N sorts the whole ~770k due set on every call, re-pegging Postgres.
-- This lets it walk in last_seen_at order and stop at the LIMIT.
--
-- CONCURRENTLY so it never locks the live table; IF NOT EXISTS so re-running is
-- a no-op.
CREATE INDEX CONCURRENTLY IF NOT EXISTS eu_players_last_seen_idx
  ON eu_players (last_seen_at ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS na_players_last_seen_idx
  ON na_players (last_seen_at ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS asia_players_last_seen_idx
  ON asia_players (last_seen_at ASC);
