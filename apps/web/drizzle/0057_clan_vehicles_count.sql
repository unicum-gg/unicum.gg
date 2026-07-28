-- Materialized clan vehicle count. The /vehicles aggregation (a DISTINCT ON over
-- ~300M snapshot rows) is too heavy to run on every clan page just to show
-- "Tanks (N)", so we write its result count back here on each on-demand load and
-- read it in the overview. Additive ADD COLUMN only.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format(
      $f$ ALTER TABLE %I_clans ADD COLUMN IF NOT EXISTS vehicles_count integer $f$,
      r
    );
  END LOOP;
END $$;
