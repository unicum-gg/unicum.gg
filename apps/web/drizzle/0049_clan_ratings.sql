-- Materialized per-clan battle-weighted ratings (one row per clan+metric),
-- recomputed hourly by the top-clans cron from the same clan_members x players
-- scan that powers the global leaderboard. Lets the by-language clan boards
-- become a cheap indexed read (filter on `languages`, order by `avg_value`)
-- instead of re-running the ~8s aggregation per (language, metric) on every
-- request. Additive CREATE TABLE only, no per-region DROP (the schema factory
-- pattern makes drizzle-kit blind to these tables; this is written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_clan_ratings (
        metric text NOT NULL,
        clan_id bigint NOT NULL,
        tag text NOT NULL,
        name text NOT NULL,
        color text NOT NULL,
        emblem text,
        languages text[] NOT NULL DEFAULT '{}',
        members_count integer NOT NULL,
        rated_members_count integer NOT NULL,
        avg_value numeric NOT NULL,
        computed_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT %I_clan_ratings_pkey PRIMARY KEY (metric, clan_id)
      )
    $f$, r, r);
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_clan_ratings_metric_avg_idx
        ON %I_clan_ratings (metric, avg_value DESC)
    $f$, r, r);
  END LOOP;
END $$;
