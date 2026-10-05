-- Where a battle's `.wotreplay` file lives, when one was kept.
--
-- The mod already sends the positions of every vehicle five times a second,
-- and that is what the 2D viewer draws: 64 KB against the file's 1.1 MB. So
-- this is not how the battle is replayed. The file is kept as insurance for a
-- 3D view we have not built, which would want shell trajectories, the geometry
-- of each hit and the state of the destructible terrain, none of which can be
-- collected after the fact.
--
-- Null for almost every row, and that is the designed state, not a gap:
--
--   * the client only writes a replay when recording is on, and the game's
--     default keeps the LAST battle only, overwriting it at the next one;
--   * one of the thirty clients sending it is enough;
--   * and the bucket has a hard 100 GB quota, because it shares a disk with
--     this database. When the quota is reached, new uploads are refused and
--     these columns simply stay null. A battle with no replay is ordinary.
--
-- The whole object key rather than a boolean, so the file can be fetched and
-- deleted from the row alone, with no second table and no naming convention
-- held in code. `replay_stored_at` is what retention sweeps by, and is
-- deliberately separate from `created_at`: a replay can arrive long after the
-- battle it belongs to, when a client flushes a backlog.

ALTER TABLE eu_battles   ADD COLUMN IF NOT EXISTS replay_key text;
ALTER TABLE na_battles   ADD COLUMN IF NOT EXISTS replay_key text;
ALTER TABLE asia_battles ADD COLUMN IF NOT EXISTS replay_key text;

ALTER TABLE eu_battles   ADD COLUMN IF NOT EXISTS replay_stored_at timestamptz;
ALTER TABLE na_battles   ADD COLUMN IF NOT EXISTS replay_stored_at timestamptz;
ALTER TABLE asia_battles ADD COLUMN IF NOT EXISTS replay_stored_at timestamptz;

-- "Which battles still have a file", for retention and for the coverage
-- figures. Partial, because the column is null on the overwhelming majority of
-- rows and a full index over hundreds of millions of nulls would cost more
-- than the question is worth.
CREATE INDEX IF NOT EXISTS eu_battles_replay_idx
  ON eu_battles (replay_stored_at) WHERE replay_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS na_battles_replay_idx
  ON na_battles (replay_stored_at) WHERE replay_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS asia_battles_replay_idx
  ON asia_battles (replay_stored_at) WHERE replay_key IS NOT NULL;
