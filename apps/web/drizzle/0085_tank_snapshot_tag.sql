-- Stable vehicle identity for the spec-history snapshots. The compact tank_id is
-- a slot id WG reuses (a removed bot/bootcamp/event vehicle's id is later handed
-- to a new tank), so the forward diff must key on the tag to avoid diffing two
-- unrelated vehicles and to credit a reused slot's introduction to the new tank.
ALTER TABLE tank_spec_snapshots ADD COLUMN IF NOT EXISTS tag text;
