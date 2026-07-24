-- Materialized stronghold leaderboard (one row per tier+period+clan), recomputed
-- hourly by the top-clans cron from the same snapshots x members aggregation that
-- powered the live query. Lets the stronghold board serve any (tier, sort,
-- period) slice as a cheap indexed read instead of re-running the ~3s CTE on
-- every request (it was cached per-combo for 10 min, so every combo switch /
-- expiry blocked ~3s). Additive CREATE TABLE only, no per-region DROP (the
-- schema factory pattern makes drizzle-kit blind to these tables; hand-written).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_stronghold_ratings (
        tier text NOT NULL,
        period text NOT NULL,
        clan_id bigint NOT NULL,
        tag text NOT NULL,
        name text NOT NULL,
        color text NOT NULL,
        emblem text,
        languages text[] NOT NULL DEFAULT '{}',
        members_count integer NOT NULL,
        elo integer,
        battles integer NOT NULL,
        wins integer NOT NULL,
        personal_rating integer,
        boost_ratio numeric,
        sr numeric,
        computed_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT %I_stronghold_ratings_pkey PRIMARY KEY (tier, period, clan_id)
      )
    $f$, r, r);
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_stronghold_ratings_tp_sr_idx
        ON %I_stronghold_ratings (tier, period, sr DESC)
    $f$, r, r);
  END LOOP;
END $$;
