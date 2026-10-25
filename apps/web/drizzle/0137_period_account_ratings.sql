-- The recent player boards (24h, 7d, 30d) rank PR and WTR as well.
--
-- Neither exists over a window (see `RatingMetric`), and serving the WNX board
-- in their place left a reader who picked WTR looking at WNX on two of the three
-- panels of the home page. So on those two a window ranks the accounts active
-- inside it (the same battle and tier floors) by their CURRENT figure, copied
-- off the player row by the hourly pass that already rebuilds this table.
--
-- Numbered 0137 because 0136 is the Hall of Fame mirror's, on its own branch.
--
-- The table is rewritten whole every hour and holds a few hundred thousand rows
-- at most, so the indexes build in a moment. Additive only, no per-region DROP
-- (the schema factory pattern makes drizzle-kit blind to these tables, so this
-- is written by hand). The columns fill on the first hourly pass after deploy.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format('ALTER TABLE %1$I_player_period_ratings ADD COLUMN IF NOT EXISTS pr real', r);
    EXECUTE format('ALTER TABLE %1$I_player_period_ratings ADD COLUMN IF NOT EXISTS wtr real', r);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %1$I_player_period_ratings_pr_idx ON %1$I_player_period_ratings (period, min_tier, pr DESC)', r);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %1$I_player_period_ratings_wtr_idx ON %1$I_player_period_ratings (period, min_tier, wtr DESC)', r);
  END LOOP;
END $$;
