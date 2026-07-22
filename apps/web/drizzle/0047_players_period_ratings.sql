-- Cached 24h + 7d recent-window ratings on the players row, mirroring the
-- existing 30d columns. The snapshot pipeline (players/index.ts
-- updatePlayerRatings) fills them whenever it records a snapshot, so the
-- top-players leaderboard cron can rank by a cached column instead of a
-- DISTINCT-ON seq scan over the 300M-row tank_snapshots table every hour
-- (see wargaming/wot/players/top). Nullable ADD COLUMN is metadata-only in
-- Postgres (no table rewrite), so this is instant on the ~2M-row tables.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      ALTER TABLE %I_players
        ADD COLUMN IF NOT EXISTS wn7_24h real,
        ADD COLUMN IF NOT EXISTS wn8_24h real,
        ADD COLUMN IF NOT EXISTS wnx_24h real,
        ADD COLUMN IF NOT EXISTS battles_24h integer,
        ADD COLUMN IF NOT EXISTS wn7_7d real,
        ADD COLUMN IF NOT EXISTS wn8_7d real,
        ADD COLUMN IF NOT EXISTS wnx_7d real,
        ADD COLUMN IF NOT EXISTS battles_7d integer
    $f$, r);
  END LOOP;
END $$;
