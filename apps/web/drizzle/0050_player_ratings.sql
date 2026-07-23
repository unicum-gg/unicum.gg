-- Materialized language-inferred ratings for the top players of a region (one
-- row per account, only accounts with an inferred language). Recomputed hourly
-- by the top-players cron so the by-language player board reads a cheap indexed
-- table instead of re-running the ~5s two-phase inference CTE per request.
-- Additive CREATE TABLE only, no per-region DROP (schema factory pattern makes
-- drizzle-kit blind to these tables; written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_player_ratings (
        account_id bigint PRIMARY KEY,
        nickname text NOT NULL,
        battles integer NOT NULL,
        wn7 real,
        wn8 real,
        wnx real,
        languages text[] NOT NULL DEFAULT '{}',
        clan_tag text,
        clan_color text,
        computed_at timestamptz NOT NULL DEFAULT now()
      )
    $f$, r);
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_player_ratings_languages_idx
        ON %I_player_ratings USING gin (languages)
    $f$, r, r);
  END LOOP;
END $$;
