-- The account's lifetime battles at the moment its marks were read, carried
-- onto `*_player_marks`.
--
-- Denormalised for the board's own predicate, the way `*_player_ratings` already
-- carries `battles` and `winrate` so its board needs no join back to the players
-- table. It is the one filter every query on this table applies, and left on the
-- players row it forces a join of the whole ranked set before anything can be
-- sorted. That is exactly what a tier column does, since it has no index to read
-- an order off and therefore sorts: measured on EU the join costs about 25ms per
-- 572 rows, so a fully backfilled board would spend ~1.7s on every click of the
-- tier X or tier XI heading. Local, the sort is over this table alone and the
-- join is only the thousand rows that survive the limit.
--
-- The battle count the board DISPLAYS still comes from the players row, so a
-- reader sees the current figure. This one only decides eligibility, and a floor
-- of a thousand battles does not care that it was read last week.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format(
      'ALTER TABLE %I_player_marks ADD COLUMN IF NOT EXISTS battles integer NOT NULL DEFAULT 0',
      r
    );
  END LOOP;
END $$;
