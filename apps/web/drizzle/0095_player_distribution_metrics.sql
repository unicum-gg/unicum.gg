-- The rating histograms, one per metric instead of only WNX.
--
-- `*_players` denormalises wn7, wn8 and wnx alike (all three fully populated:
-- 1,875,796 EU accounts at 100+ battles carry each), so computing the other two
-- costs nothing beyond two more aggregates in the pass that was already reading
-- the table. The site lets the reader pick their metric in the navbar, and the
-- distributions had no business naming one for them.
--
-- The existing `wnx` column is reused as the WNX series, so no data is lost and
-- the next cron tick fills the two new ones.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      ALTER TABLE %I_player_distribution
        ADD COLUMN IF NOT EXISTS wn7 jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS wn8 jsonb NOT NULL DEFAULT '[]'::jsonb
    $f$, r);
  END LOOP;
END $$;
