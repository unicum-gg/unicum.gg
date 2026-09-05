-- The Onslaught season as it happens, rather than as it ended.
--
-- `*_onslaught_ratings` is keyed (event_id, account_id), so it holds one state
-- per player and every feeder pass overwrites the last. That was enough while
-- the feeder ran once per finished season, and it is the wrong shape now that it
-- runs continuously: the whole point of running it live is the shape of the
-- climb, and an upsert erases it.
--
-- The source keeps nothing. `wgelen` recomputes the board every five minutes and
-- serves that instant only, so a season's opening days exist nowhere once they
-- pass. On the first day of the Azure Phoenix season EU had 47 ranked players
-- against roughly 4000 at the end of the previous one, and no site archives that
-- ramp. These two tables are the record, which is also why the feeder writes
-- nothing on a failed fetch rather than a zero, exactly like the server sampler.
--
-- Additive CREATE TABLE / ADD COLUMN only, no per-region DROP (the schema
-- factory pattern makes drizzle-kit blind to these tables, so this is written by
-- hand and applied with psql).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    -- One row per player per instant their standing MOVED. Written
    -- differentially: a pass compares the incoming board against
    -- `*_onslaught_ratings` (the last known state) and records only the rows
    -- whose rank, rating or battles changed, so a player who did not play
    -- between two passes costs nothing. A season is therefore a few hundred
    -- thousand rows rather than one full board per pass.
    --
    -- The recorded nickname and clan are deliberately absent: they live on the
    -- current-state row, and duplicating them here would store the same string
    -- a few hundred times per player for a value that is not what changed.
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_onslaught_rating_history (
        event_id text NOT NULL,
        account_id bigint NOT NULL,
        captured_at timestamptz NOT NULL,
        rank integer NOT NULL,
        rating integer NOT NULL,
        battles integer NOT NULL,
        -- A player's progression reads WHERE event_id = $1 AND account_id = $2
        -- ORDER BY captured_at, which is the primary key's own prefix.
        PRIMARY KEY (event_id, account_id, captured_at)
      )
    $f$, r);
    -- Everything aggregated across players at one instant (the population, the
    -- band of a rank) scans a slice of the season instead.
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_onslaught_rating_history_event_time_idx
        ON %I_onslaught_rating_history (event_id, captured_at)
    $f$, r, r);

    -- The board's own state at each pass, one row per pass per season. Small by
    -- construction (a pass an hour over a six week season is a few hundred
    -- rows), so it is written every pass whether or not anything moved: the
    -- regular cadence is what makes it a curve.
    --
    -- This is the table behind the question the mode actually asks, which is
    -- what it takes to hold a rank today. `elite_points` is Wargaming's own
    -- Legend threshold and comes from the board meta. The Champion cutoff has no
    -- published points value, so the feeder reads the rating sitting at
    -- `master_position` and stores it, and `min_rating` is the last ranked
    -- player, which is the real price of entry.
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_onslaught_season_snapshots (
        event_id text NOT NULL,
        captured_at timestamptz NOT NULL,
        -- How many players hold a place on the board at this instant.
        ranked_count integer NOT NULL,
        -- Rank thresholds as served (positions) plus the points behind them.
        elite_position integer,
        elite_points integer,
        master_position integer,
        master_points integer,
        -- The board's top and bottom rating, so the spread is readable without
        -- touching the history table.
        top_rating integer,
        min_rating integer,
        -- Battles summed over every ranked player: the mode's activity, free to
        -- compute since the pass already holds every row.
        total_battles bigint,
        -- The source's own last-recomputation stamp. A finished season stops
        -- moving, which is how a stale board is told from a quiet one.
        last_recalculation_ts bigint,
        PRIMARY KEY (event_id, captured_at)
      )
    $f$, r);

    -- Which year (chapter) a season belongs to, so its position inside that year
    -- can be counted from our own archive.
    --
    -- Onslaught runs as years of three seasons, and the client names them in a
    -- localization file that pre-lists all three from the year's first day. So
    -- "the last season the client names" is not the live one, and reading it
    -- that way stamps a season with a name and rank art belonging to a season
    -- that has not happened yet. The year is `COMP7_MASKOT_ID`, a number the
    -- client increments per year (the Dragon year was 5, the Phoenix year is 6),
    -- which makes the live season's ordinal a count of the seasons we already
    -- hold for that year rather than a guess.
    EXECUTE format($f$
      ALTER TABLE %I_onslaught_seasons
        ADD COLUMN IF NOT EXISTS year_id text,
        ADD COLUMN IF NOT EXISTS year_name text
    $f$, r);
  END LOOP;
END $$;
