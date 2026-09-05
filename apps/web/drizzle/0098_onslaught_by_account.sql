-- Reading the Onslaught tables from a PLAYER's side.
--
-- Both are keyed (event_id, account_id ...), which is the board's own order and
-- answers "who is ranked in this season" as an index scan. The player page asks
-- the transpose, "which seasons is this account ranked in", and that prefix is
-- not usable for it: without these, a profile view scans every standing of every
-- season, and the archive only ever grows.
--
-- Cheap to carry: a few thousand rows per season on the standings, and the
-- history index is the one that keeps a player's climb an index seek once a full
-- EU season has written a few hundred thousand rows.
--
-- Additive CREATE INDEX only, no per-region DROP (the schema factory pattern
-- makes drizzle-kit blind to these tables; written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_onslaught_ratings_account_idx
        ON %I_onslaught_ratings (account_id)
    $f$, r, r);
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_onslaught_rating_history_account_idx
        ON %I_onslaught_rating_history (account_id, captured_at)
    $f$, r, r);
  END LOOP;
END $$;
