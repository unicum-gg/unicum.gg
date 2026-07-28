-- The workflow owner's WG nickname (snapshot), so the console can show "runs on
-- <name>" and let another officer take over. Additive ADD COLUMN only.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format(
      $f$ ALTER TABLE %I_clan_boost_workflow ADD COLUMN IF NOT EXISTS owner_name text NOT NULL DEFAULT '' $f$,
      r
    );
  END LOOP;
END $$;
