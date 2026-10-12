-- What a player actually had fitted in one battle, for one life.
--
-- Written by hand for the same two reasons `0120_battles.sql` was: drizzle-kit
-- cannot express partitioning, and it cannot see a table built by a
-- `makeXxxTable(region)` factory either, so `db:generate` would propose
-- dropping every per-region table in the schema (see AGENTS.md).
--
-- `tank_loadouts` already answers "what does this account run on this tank
-- today", and replaces the row whenever the setup changes, on purpose. That is
-- the wrong shape for asking whether a device or a crew skill is worth fitting,
-- which needs the loadout that was in use in a battle whose result is known,
-- and therefore needs rows that accumulate instead of rows that are replaced.
--
-- PARTITION BY RANGE on `started_at`, monthly, matching `battles` exactly. Not
-- a preference: the two tables are always read together, and joining tables
-- partitioned differently loses both partition pruning and the partition-wise
-- join, so a sweep over one month would read the entire history instead of one
-- partition of each. The primary key leads with the partition key because
-- Postgres requires it inside every unique constraint on a partitioned table.
--
-- The key is (battle, vehicle, life). `life` is in it because a respawn mode
-- gives a player several loadouts in one battle, and without it the second
-- would overwrite the first and the write would still succeed.
--
-- The flat columns deliberately carry the names `tank_loadouts` uses, so that
-- one query can read across both tables: what a population runs now, and what
-- it ran then. Two columns have no counterpart there and are the point of this
-- table: `crew_role_skills` keeps each skill with the SEAT that trained it,
-- which a deduplicated list cannot, and `devices_triple` makes the trio of
-- devices groupable, because devices are chosen as a set and a figure for one
-- device alone is an average over every trio it happens to appear in.
--
-- Rows are immutable: no `updated_at`, and nothing upserts the contents. What
-- was fitted in a battle is not corrected later. Two rows that disagree are two
-- sources disagreeing, which is what `source` records.

DO $$
DECLARE
  region text;
  month_start date;
  month_end date;
BEGIN
  FOREACH region IN ARRAY ARRAY['eu', 'na', 'asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I (
        started_at timestamp with time zone NOT NULL,
        arena_unique_id text NOT NULL,
        vehicle_id bigint NOT NULL,
        life smallint NOT NULL,
        account_id bigint,
        tank_id bigint,
        client_version text,
        source smallint NOT NULL,
        opt_devices text[],
        devices_triple text,
        boosters text[],
        consumables text[],
        crew_skills text[],
        crew_role_skills text[],
        premium_shell_share real,
        shells_loaded integer,
        crew jsonb,
        shells jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT %I PRIMARY KEY (started_at, arena_unique_id, vehicle_id, life)
      ) PARTITION BY RANGE (started_at)
    $f$, region || '_battle_loadouts', region || '_battle_loadouts_pkey');

    -- The aggregate's own access path: one tank, over a window of time. Every
    -- question about the population is asked one tank at a time, because
    -- comparing a device across tanks compares the tanks.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (tank_id, started_at)',
      region || '_battle_loadouts_tank_idx', region || '_battle_loadouts');
    -- "What did THIS account run on this tank, battle by battle." The
    -- within-player contrast, which is the only comparison here that is not
    -- confounded by the fact that the player chose the loadout.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (account_id, tank_id, started_at)',
      region || '_battle_loadouts_account_idx', region || '_battle_loadouts');
    -- Containment, which is what "who ran this device" and "who trained this
    -- perk on this seat" both reduce to.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I USING gin (opt_devices)',
      region || '_battle_loadouts_devices_idx', region || '_battle_loadouts');
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I USING gin (crew_role_skills)',
      region || '_battle_loadouts_skills_idx', region || '_battle_loadouts');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I DEFAULT',
      region || '_battle_loadouts_default', region || '_battle_loadouts');

    month_start := (date_trunc('month', now()) - interval '1 month')::date;
    FOR i IN 0..24 LOOP
      month_end := (month_start + interval '1 month')::date;
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        region || '_battle_loadouts_' || to_char(month_start, 'YYYY_MM'),
        region || '_battle_loadouts', month_start, month_end);
      month_start := month_end;
    END LOOP;
  END LOOP;
END $$;

-- Whether anything landed in a DEFAULT partition, which is still the only way
-- this shape fails quietly: the write succeeds, and the month the row belonged
-- to can no longer be attached.
--
-- The existing view is extended rather than joined by a second one, so that a
-- gap in either table is seen by the same look. Dropped and recreated rather
-- than replaced because the shape gains a column naming the table, and nothing
-- in the application reads this view: it is a diagnostic, queried by hand.
DROP VIEW IF EXISTS battles_partition_gap;
CREATE VIEW battles_partition_gap AS
SELECT 'eu' AS region, 'battles' AS source_table, count(*) AS rows FROM eu_battles_default
UNION ALL SELECT 'na', 'battles', count(*) FROM na_battles_default
UNION ALL SELECT 'asia', 'battles', count(*) FROM asia_battles_default
UNION ALL SELECT 'eu', 'battle_loadouts', count(*) FROM eu_battle_loadouts_default
UNION ALL SELECT 'na', 'battle_loadouts', count(*) FROM na_battle_loadouts_default
UNION ALL SELECT 'asia', 'battle_loadouts', count(*) FROM asia_battle_loadouts_default;
