-- Stamp each player's FIRST snapshot on the player row, so the /coverage trend
-- stops re-deriving it.
--
-- It was computed as `SELECT player_id, MIN(taken_at) FROM *_player_snapshots
-- GROUP BY player_id` on every tick: a full aggregate of 17M rows (11 GB on EU)
-- recomputing dates that cannot change. On 2026-09-15 that scan ran hourly, took
-- 143s, and evicted the page cache every other query depends on — player pages
-- went from 0.2s to 24s while it ran, and the site answered 503.
--
-- Written once per player and never updated (the write COALESCEs on itself), so
-- NULL means "never snapshotted", which is the population /coverage already
-- counts as awaiting its first fetch.

ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "first_snapshot_at" timestamp with time zone;
ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "first_snapshot_at" timestamp with time zone;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "first_snapshot_at" timestamp with time zone;

-- Partial: the reader only ever asks for a trailing window, and the column is
-- NULL for every player still waiting on a first fetch, which is a large share
-- of the table and none of the answer.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "eu_players_first_snapshot_at_idx"
  ON "eu_players" ("first_snapshot_at") WHERE "first_snapshot_at" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "na_players_first_snapshot_at_idx"
  ON "na_players" ("first_snapshot_at") WHERE "first_snapshot_at" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "asia_players_first_snapshot_at_idx"
  ON "asia_players" ("first_snapshot_at") WHERE "first_snapshot_at" IS NOT NULL;
