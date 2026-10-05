-- Battles as the client's own results report them, one row per battle.
--
-- Written by hand rather than generated: drizzle-kit cannot express
-- partitioning, and it cannot see a table built by a `makeXxxTable(region)`
-- factory either, so `db:generate` would have emitted DROP TABLE for every
-- per-region table in the schema (see AGENTS.md).
--
-- PARTITION BY RANGE on `started_at`, from the first migration, because this is
-- the one choice here that cannot be redone cheaply: a thousand active players
-- is ~8.9M rows a year, and converting a plain table to a partitioned one means
-- moving all of it. The primary key leads with the partition key because
-- Postgres requires it inside every unique constraint on a partitioned table.
--
-- `arena_unique_id` is text, not bigint: the game's battle id runs to 19 digits,
-- past what a JSON number survives, and it crosses the API on every write.
--
-- Monthly partitions are created ahead for two years. The DEFAULT partition is
-- a safety net that should stay empty: a row landing there blocks ATTACH of the
-- month it belongs to, so `battles_partition_gap` below is what tells us.

DO $$
DECLARE
  region text;
  month_start date;
  month_end date;
BEGIN
  FOREACH region IN ARRAY ARRAY['eu', 'na', 'asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I (
        arena_unique_id text NOT NULL,
        started_at timestamp with time zone NOT NULL,
        map_name text NOT NULL,
        battle_type integer NOT NULL,
        gameplay_id text,
        duration integer,
        winner_team integer,
        finish_reason integer,
        client_version text,
        server text,
        player_ids integer[] NOT NULL,
        vehicles jsonb NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT %I PRIMARY KEY (started_at, arena_unique_id)
      ) PARTITION BY RANGE (started_at)
    $f$, region || '_battles', region || '_battles_pkey');

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I USING gin (player_ids)',
      region || '_battles_players_idx', region || '_battles');
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (started_at)',
      region || '_battles_started_idx', region || '_battles');
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (battle_type, started_at)',
      region || '_battles_type_idx', region || '_battles');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I DEFAULT',
      region || '_battles_default', region || '_battles');

    month_start := (date_trunc('month', now()) - interval '1 month')::date;
    FOR i IN 0..24 LOOP
      month_end := (month_start + interval '1 month')::date;
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        region || '_battles_' || to_char(month_start, 'YYYY_MM'),
        region || '_battles', month_start, month_end);
      month_start := month_end;
    END LOOP;
  END LOOP;
END $$;

-- Whether anything landed in a DEFAULT partition, which is the only way this
-- shape fails quietly: the write succeeds, and the month it belonged to can no
-- longer be attached.
CREATE OR REPLACE VIEW battles_partition_gap AS
SELECT 'eu' AS region, count(*) AS rows FROM eu_battles_default
UNION ALL SELECT 'na', count(*) FROM na_battles_default
UNION ALL SELECT 'asia', count(*) FROM asia_battles_default;
