-- Three corrections to 0120, all of them free while the table is empty.
--
-- 1. `player_ids` was `integer[]`. The game's account ids do not fit.
--
--    Measured on this database: 32394 of Asia's 254540 accounts (12.7%) are
--    above int4's 2147483647, the largest being 3021341123. Every other
--    `account_id` column in the schema is already `bigint`; this was the one
--    exception, and it was a mistake rather than a choice.
--
--    What it would have cost: a thirty-player battle has a ~98% chance of
--    containing at least one Asia id above the limit, the whole INSERT aborts
--    on it, the endpoint answers 502, and the mod retries the same batch for
--    ever. Asia would have stored almost nothing, loudly and permanently.
--
-- 2. `reported_by`, the accounts that told us about this battle.
--
--    A battle is a statement about thirty accounts, and only the sender's is
--    proven. The endpoint checks the sender is among the players, which bounds
--    who must appear but not what is said about the other twenty-nine. Without
--    a record of who sent a row, a fabricated battle can be neither found nor
--    withdrawn: there is no query that answers "everything this account
--    reported". That is the one thing `tank_loadouts` gets for free, by being
--    keyed on the proven account, and that this table threw away.
--
--    It also makes multi-source coverage measurable, which is the whole
--    premise of collecting battles from any participant.
--
-- 3. `ensure_battles_partitions(months_ahead)`, so extending the monthly
--    partitions is one call rather than re-running 0120 by hand. 0120 created
--    25 months ending 2028-09; past that every battle would land in the
--    DEFAULT partition, where the write succeeds and the month it belonged to
--    can then never be attached. This does not schedule itself: it makes the
--    fix cheap and findable, and `battles_partition_gap` still reports the
--    damage if nobody calls it.

ALTER TABLE eu_battles   ALTER COLUMN player_ids TYPE bigint[];
ALTER TABLE na_battles   ALTER COLUMN player_ids TYPE bigint[];
ALTER TABLE asia_battles ALTER COLUMN player_ids TYPE bigint[];

ALTER TABLE eu_battles   ADD COLUMN IF NOT EXISTS reported_by bigint[] NOT NULL DEFAULT '{}';
ALTER TABLE na_battles   ADD COLUMN IF NOT EXISTS reported_by bigint[] NOT NULL DEFAULT '{}';
ALTER TABLE asia_battles ADD COLUMN IF NOT EXISTS reported_by bigint[] NOT NULL DEFAULT '{}';

-- Add months to every region's table, from the month before `now` forward.
--
-- Idempotent: `IF NOT EXISTS` on a deterministic name, so calling it twice in
-- a month does nothing and calling it every month keeps the horizon ahead.
-- The DEFAULT partition is left alone; it already exists, and each ATTACH has
-- to scan it, which is free only while it is empty.
CREATE OR REPLACE FUNCTION ensure_battles_partitions(months_ahead integer DEFAULT 24)
RETURNS integer AS $$
DECLARE
  region text;
  month_start date;
  month_end date;
  made integer := 0;
  name text;
BEGIN
  FOREACH region IN ARRAY ARRAY['eu', 'na', 'asia'] LOOP
    month_start := (date_trunc('month', now()) - interval '1 month')::date;
    FOR i IN 0..months_ahead LOOP
      month_end := (month_start + interval '1 month')::date;
      name := region || '_battles_' || to_char(month_start, 'YYYY_MM');
      IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = name) THEN
        EXECUTE format(
          'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
          name, region || '_battles', month_start, month_end);
        made := made + 1;
      END IF;
      month_start := month_end;
    END LOOP;
  END LOOP;
  RETURN made;
END $$ LANGUAGE plpgsql;

SELECT ensure_battles_partitions(24);
