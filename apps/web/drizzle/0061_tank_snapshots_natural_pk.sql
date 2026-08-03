-- Drop the surrogate `id` on *_tank_snapshots and promote the natural key
-- (player_id, tank_id, battles) to primary key.
--
-- Why: `id` was a `serial`, i.e. a 4-byte counter capped at 2,147,483,647. EU
-- hit that ceiling on 2026-07-28 at 17:59 UTC and every tank-snapshot insert
-- has failed since with `2200H nextval: reached maximum value of sequence`, so
-- the pipeline kept spending its WG budget and threw every result away. NA was
-- at 53% and Asia at 36% of the same ceiling, so this was a matter of months
-- for them too.
--
-- Why not bigint: `ALTER COLUMN id TYPE bigint` rewrites the whole table (81 GB
-- and 317M rows on EU) under ACCESS EXCLUSIVE, i.e. hours of downtime, to keep
-- a column nothing references. `id` was only ever the PK plus a tie-breaker for
-- rows sharing a `taken_at`, and `battles` does that job better (it is
-- monotonic per tank and already part of the unique index). The unique index
-- on (player_id, tank_id, battles) already exists, so promoting it is a
-- catalog-only operation: no rewrite, no reindex, and it frees the 12 GB the
-- old `_pkey` index took on EU alone.
--
-- Ordering: deploy the code that stopped selecting `id` FIRST. The running
-- build orders by tank_snapshots.id, and would 500 on player pages the moment
-- the column disappears.
--
-- Both statements need a brief ACCESS EXCLUSIVE lock. `lock_timeout` keeps a
-- long-running read from turning the wait into a pile-up behind us: on timeout
-- nothing is applied (the DO block is one transaction) and the file can simply
-- be re-run.
SET lock_timeout = '5s';

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    -- Drops the old `<r>_tank_snapshots_pkey` constraint and its index with the
    -- column, and the OWNED BY sequence `<r>_tank_snapshots_id_seq` with it.
    EXECUTE format(
      $f$ ALTER TABLE %I_tank_snapshots DROP COLUMN IF EXISTS id $f$,
      r
    );

    -- Reuse the existing unique index as the new PK (renames it to the
    -- constraint name). Guarded so a re-run after a partial apply is a no-op.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('%I_tank_snapshots', r)::regclass AND contype = 'p'
    ) THEN
      EXECUTE format(
        $f$ ALTER TABLE %I_tank_snapshots
            ADD CONSTRAINT %I PRIMARY KEY USING INDEX %I $f$,
        r,
        format('%s_tank_snapshots_pkey', r),
        format('%s_tank_snapshots_player_tank_battles_unique_idx', r)
      );
    END IF;
  END LOOP;
END $$;
