-- A ranked player's Onslaught activity, folded to one row per day played.
--
-- Everything the mode publishes is cumulative: the board serves a rank, a
-- points total and a battle count, for the present instant only. A rate (how
-- many battles a day, what a day of play is worth in points) exists nowhere
-- upstream and is only recoverable by differencing captures, which is what the
-- rating history beside this table holds.
--
-- Differencing it per read does not scale with the season. One EU season is
-- already ~170,000 captures at a quarter-hour cadence and the pass is moving to
-- five minutes, so the same answer would cost three times more each read, on a
-- board that is prerendered per locale. The deltas are therefore folded once,
-- by the pass that walks them, and the read becomes a grouped scan of a few
-- tens of thousands of rows.
--
-- Written by hand: the schema factory pattern makes drizzle-kit blind to the
-- per-region tables (see AGENTS.md).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_onslaught_daily (
        event_id text NOT NULL,
        account_id bigint NOT NULL,
        -- The UTC calendar day, like the servers section's own buckets, so
        -- nothing silently depends on the process's timezone.
        day date NOT NULL,
        -- Battles played that day, summed from the captures' differences. A
        -- GAIN, never a total: a player joins the board already carrying what
        -- they played to qualify, and that value belongs to no day. It also
        -- counts only what could be placed on this day (see the columns below),
        -- so a season's days deliberately do not sum to its totals.
        battles integer NOT NULL,
        -- Rating points won or lost that day. Signed: a losing day costs
        -- rating, and a mean that cannot go down would flatter everyone.
        points integer NOT NULL,
        -- How many captures of that day carried a gain. Cadence-dependent (the
        -- feeder's interval has changed and will again), so it is raw material
        -- rather than a figure to publish as it stands.
        samples integer NOT NULL,
        -- The last capture of that day that moved, which is what "last seen
        -- playing" reads. The day alone would answer to within 24 hours.
        last_at timestamptz NOT NULL,
        -- The player's cumulative season totals at the day's LAST capture,
        -- which is not always `last_at` above: that one is the last capture
        -- that moved. The gains are what this table is read for, but the
        -- absolute value is what makes the entry cost recoverable: on a
        -- player's first day here, battles_total minus battles is exactly what
        -- they had played when they first appeared on the board, which is the
        -- price of qualifying.
        battles_total integer NOT NULL,
        rating_total integer NOT NULL,
        -- Where they stood that day: the best position they held during it, and
        -- the one they held at its last capture. The fold reads the captures
        -- anyway, so these cost nothing here and save the alternative, which is
        -- differencing the whole season's history on the read path. They are
        -- what lets the board name the players who LOST their place: the feeder
        -- prunes anyone who has left the board from the standings, so the fold
        -- is where they are recovered from.
        best_rank integer NOT NULL,
        rank_end integer NOT NULL,
        CONSTRAINT %I_onslaught_daily_pkey PRIMARY KEY (event_id, account_id, day)
      )
    $f$, r, r);
    -- The rebuild replaces one day of one season at a time, which the primary
    -- key's own prefix cannot serve.
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_onslaught_daily_event_day_idx
        ON %I_onslaught_daily (event_id, day)
    $f$, r, r);
    -- One player across every season, which a profile asks and the primary
    -- key's own prefix cannot serve. It is what tells a player page that they
    -- held a place in a season they are no longer ranked in, since the
    -- standings row that would have said so is exactly what the prune removed.
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_onslaught_daily_account_idx
        ON %I_onslaught_daily (account_id, day)
    $f$, r, r);
  END LOOP;
END $$;
