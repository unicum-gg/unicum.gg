-- The total experience of each battle mode on the player snapshot.
--
-- The snapshot kept each mode's `battle_avg_xp` alone, an integer Wargaming
-- rounds, and the profile's 24h/7d/30d mode columns diffed those averages
-- directly: a difference of two career averages, which is a few points either
-- way and reads as "-3.00" experience over 177 Skirmishes. The period figure
-- needs the totals, and every mode block already carries one (`xp`), so it is
-- stored beside the average from now on.
--
-- Nullable and filled from the next snapshot onwards: Wargaming reports
-- lifetime totals only, so nothing before today can be recovered. Until both
-- ends of a window carry it, the read rebuilds the totals from the averages
-- (`battle_avg_xp * battles`), which is close and never absurd.
--
-- ADD COLUMN with no default is a catalogue change only, so this does not
-- rewrite the table. Written by hand: the schema factory pattern makes
-- drizzle-kit blind to the per-region tables.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      ALTER TABLE %1$I_player_snapshots
        ADD COLUMN IF NOT EXISTS skirmish_xp bigint,
        ADD COLUMN IF NOT EXISTS fortified_xp bigint,
        ADD COLUMN IF NOT EXISTS epic_xp bigint,
        ADD COLUMN IF NOT EXISTS fallout_xp bigint,
        ADD COLUMN IF NOT EXISTS ranked_xp bigint,
        ADD COLUMN IF NOT EXISTS cw_absolute_xp bigint,
        ADD COLUMN IF NOT EXISTS cw_champion_xp bigint,
        ADD COLUMN IF NOT EXISTS cw_middle_xp bigint
    $f$, r);
  END LOOP;
END $$;
