-- Cumulative holder counts per tank among qualifying tracked players. moeN =
-- players with >= N Marks of Excellence; mom_classX = players who reached that
-- Mastery class or better. Nullable; the top-players-by-tank cron fills them.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format('ALTER TABLE %I_tank_stats
      ADD COLUMN IF NOT EXISTS moe_1 integer,
      ADD COLUMN IF NOT EXISTS moe_2 integer,
      ADD COLUMN IF NOT EXISTS moe_3 integer,
      ADD COLUMN IF NOT EXISTS mom_class3 integer,
      ADD COLUMN IF NOT EXISTS mom_class2 integer,
      ADD COLUMN IF NOT EXISTS mom_class1 integer,
      ADD COLUMN IF NOT EXISTS mom_ace integer', r);
  END LOOP;
END $$;
