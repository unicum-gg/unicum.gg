-- An Onslaught place, denormalised onto the player row so it can be worn.
--
-- The crest beside a nickname is drawn on every board, every clan roster and
-- every search row, and answering "was this player ever ranked" from the
-- standings would mean joining the archive on each of them. The tournament
-- crest is denormalised for exactly this reason (0095), and this is its twin.
--
-- Three columns because a crest needs more than a boolean. The TIER picks the
-- tincture, since being Champion and being Legend are not the same claim: 4173
-- accounts on EU have held a place at all, and 624 of those reached Legend.
-- The best RANK is what the tooltip names, because "#7 in the Azure Phoenix"
-- says something "ranked" does not. The SEASON COUNT separates a player who did
-- it once from one who does it every season, which is the difference between a
-- good run and a habit.
--
-- Written by the daily reconcile, which already reads the standings, and
-- recomputed from them in full each time rather than incremented: the source is
-- a few thousand rows per region, so the honest recount costs nothing and
-- cannot drift the way a counter does.
--
-- Additive ADD COLUMN only, no per-region DROP (the schema factory pattern
-- makes drizzle-kit blind to these tables; written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      ALTER TABLE %I_players
        -- 'legend' or 'champion': the best rank this account has ever held.
        -- Null for the overwhelming majority, who have never been on the board.
        ADD COLUMN IF NOT EXISTS onslaught_best_tier text,
        -- The best leaderboard position, across every season we hold.
        ADD COLUMN IF NOT EXISTS onslaught_best_rank integer,
        -- How many distinct seasons they have been ranked in.
        ADD COLUMN IF NOT EXISTS onslaught_seasons integer NOT NULL DEFAULT 0
    $f$, r);
    -- The crest is read by account id on rows the badge resolver has already
    -- narrowed, so no index of its own: the lookup is the players primary key.
  END LOOP;
END $$;
