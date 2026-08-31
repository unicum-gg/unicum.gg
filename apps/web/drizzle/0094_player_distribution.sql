-- How the region's players are spread across win rate and WNX, and how its
-- battles are spread across tiers and vehicle types. ONE singleton row per
-- region, recomputed hourly by `player-distribution-cron`.
--
-- Materialised for the reason the coverage trends beside it already document:
-- the two histograms are a full scan of `*_players` (2.1M rows, 2.3 GB on EU,
-- ~380ms measured), which is fine once an hour in the background and not fine
-- on a page whose three regions revalidate together after a deploy. The tier
-- and type breakdowns aggregate the ~1000-row `*_tank_stats` in ~46ms and could
-- be read live, but they are part of the same answer and are stored with it so
-- the page reads one row rather than a row plus a join.
--
-- The buckets carry their own edges rather than bare counts, so a row written
-- under an older range still draws correctly and the percentile maths reads the
-- edges it was actually built with.
--
-- Additive CREATE TABLE only, no per-region DROP (the schema factory pattern
-- makes drizzle-kit blind to these tables; this is written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_player_distribution (
        id smallint PRIMARY KEY DEFAULT 1,
        min_battles integer NOT NULL,
        players bigint NOT NULL,
        winrate jsonb NOT NULL,
        wnx jsonb NOT NULL,
        by_tier jsonb NOT NULL,
        by_type jsonb NOT NULL,
        computed_at timestamptz NOT NULL DEFAULT now()
      )
    $f$, r);
  END LOOP;
END $$;
