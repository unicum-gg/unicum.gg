-- Recorded population of the game's clusters, one row per cluster per sample.
--
-- Wargaming publishes population as an instant and nothing else: `wgn/servers/
-- info` answers "how many are playing right now", there is no history endpoint,
-- and nobody archives the series. Every figure the servers section shows beyond
-- the current minute exists only because this table recorded it, so the history
-- starts the day the sampler first ran and cannot be backfilled. Losing this
-- table loses the data for good.
--
-- `server` is verbatim what Wargaming returns ("EU1", "203", "501"), which is
-- also the name the game's own server selector shows (the client reads it from
-- the login response, it is not in the client files). It is deliberately not a
-- rank: the read path used to relabel the clusters EU1..EUn by descending
-- population, so a series keyed on that would splice two different servers
-- together every time they traded places.
--
-- `sampled_at` is floored to the sampling period, so every cluster of a region
-- shares one timestamp and a region total is a plain GROUP BY. The primary key
-- is that pair, so a tick that runs twice for one period (two processes racing
-- the lease, a retry after a partial write) rewrites the same rows instead of
-- doubling that instant's population.
--
-- Additive CREATE TABLE only, no per-region DROP (the schema factory pattern
-- makes drizzle-kit blind to these tables; this is written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_server_online (
        server text NOT NULL,
        sampled_at timestamptz NOT NULL,
        players_online integer NOT NULL,
        CONSTRAINT %I_server_online_pkey PRIMARY KEY (server, sampled_at)
      )
    $f$, r, r);
    -- Every read is a time window across all of the region's clusters (the
    -- population series, the weekly rhythm, the peak), so the scan is by date
    -- first and the primary key's server-major order does not serve it.
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_server_online_sampled_at_idx
        ON %I_server_online (sampled_at)
    $f$, r, r);
  END LOOP;
END $$;
