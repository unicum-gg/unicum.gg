-- `shells_loaded` widened from smallint to integer.
--
-- The column holds how many rounds a vehicle carries across its active setup.
-- A smallint stops at 32767, which looked generous until the endpoint's own
-- per-round cap had to be raised: a vehicle whose main armament is a 12.7mm
-- machine gun loads 2700 rounds, and eight kinds of round at the ceiling the
-- endpoint now allows would overflow the column. An overflow here is a failed
-- write, not a wrong number, so the whole upload would be refused over one
-- scout.
--
-- Free to apply right now and not later: the tables hold about fifty rows,
-- from the first upload of a single player. A widening rewrites the table.
--
-- Written by hand like 0110 and for the same reason: drizzle-kit cannot see
-- into the per-region table factory. See AGENTS.md.

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      ALTER TABLE %I_tank_loadouts
        ALTER COLUMN shells_loaded TYPE integer
    $f$, r);
  END LOOP;
END $$;
