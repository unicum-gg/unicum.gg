-- What each band of the region's players wins at each tier: one row per
-- (metric, band, tier), about three hundred per region, rewritten nightly by
-- the `top-players-by-tank` cron.
--
-- Written by that cron rather than by a pass of its own. A win rate per tier
-- only exists in `*_tank_snapshots` (360 million rows, 85 GB on EU), the table
-- nothing may scan for a page, and that cron already streams it end to end with
-- the player row joined on, so the grid is accumulated in the walk that was
-- happening anyway.
--
-- The counters are stored and the win rate derived at read, so a cell can be
-- re-summed across bands or across tiers instead of being an average of
-- averages.
--
-- Additive CREATE TABLE only, no per-region DROP (the schema factory pattern
-- makes drizzle-kit blind to these tables; this is written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_tier_winrate (
        metric text NOT NULL,
        band text NOT NULL,
        -- The band's edges as the colour function drew them when the row was
        -- written, half-open and null at the scale's two open ends. Stored so a
        -- threshold that moves later cannot relabel a row it never measured,
        -- the same reason the distribution buckets carry their own edges.
        band_from integer,
        band_to integer,
        tier smallint NOT NULL,
        min_battles integer NOT NULL,
        players integer NOT NULL,
        battles bigint NOT NULL,
        wins bigint NOT NULL,
        computed_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (metric, band, tier)
      )
    $f$, r);
  END LOOP;
END $$;
