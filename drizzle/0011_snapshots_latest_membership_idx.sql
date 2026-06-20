-- Covering index for the "latest membership per player" DISTINCT ON used by
-- top-clans cron and top-players-by-language. Without it postgres scans the
-- ~1M-row snapshot table then heap-fetches clan_id+battles for every row.
-- INCLUDE makes the index self-sufficient: pure index-only scan, no heap.
-- Partial WHERE skips the ~half of snapshots where the player wasn't in any
-- clan at that time. CONCURRENTLY so live traffic isn't blocked; cannot run
-- inside a transaction, apply via `psql "$DATABASE_URL" -f drizzle/0011_*.sql`.

CREATE INDEX CONCURRENTLY IF NOT EXISTS eu_snapshots_latest_membership_idx
  ON eu_player_snapshots (player_id, taken_at DESC, id DESC)
  INCLUDE (clan_id, battles)
  WHERE clan_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS na_snapshots_latest_membership_idx
  ON na_player_snapshots (player_id, taken_at DESC, id DESC)
  INCLUDE (clan_id, battles)
  WHERE clan_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS asia_snapshots_latest_membership_idx
  ON asia_player_snapshots (player_id, taken_at DESC, id DESC)
  INCLUDE (clan_id, battles)
  WHERE clan_id IS NOT NULL;
