-- Materialized /coverage snapshot trends, one singleton row per region. The
-- source aggregates are full seq-scans of the 10M+ row *_player_snapshots tables
-- (a rolling 24h count + two 30-day daily histograms, the per-player MIN(taken_at)
-- CTE being the ~24s heaviest). Recomputed hourly by the coverage-trends cron so
-- /coverage reads one cheap row instead of scanning on the request path, where a
-- cold cache let a thundering herd fire several concurrent scans and saturate the
-- shared host. Additive CREATE TABLE only, no per-region DROP (the schema factory
-- pattern makes drizzle-kit blind to these tables; written by hand). No index: a
-- single-row-per-region fetch.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_coverage_trends (
        id smallint PRIMARY KEY DEFAULT 1,
        player_snapshots_last24h bigint NOT NULL,
        player_snapshots_daily jsonb NOT NULL,
        first_snapshots_daily jsonb NOT NULL,
        computed_at timestamptz NOT NULL DEFAULT now()
      )
    $f$, r);
  END LOOP;
END $$;
