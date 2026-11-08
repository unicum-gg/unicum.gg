-- Draws per vehicle, so the profile's 24h/7d/30d columns can be diffed from
-- the vehicles alone. Wargaming refreshes the account record only when the
-- player logs out, while the vehicle record follows every battle, so a column
-- mixing the two contradicted itself during a session.
--
-- Additive only, written by hand (the schema factory pattern makes drizzle-kit
-- blind to per-region tables). A nullable column with no default is a catalog
-- change, so these tables are not rewritten, but ADD COLUMN still needs an
-- ACCESS EXCLUSIVE lock: the lock_timeout makes it give up rather than queue
-- every tank write behind a long reader (the nightly by-tank walk). Re-run it
-- if it times out.
SET lock_timeout = '5s';

ALTER TABLE eu_tank_snapshots ADD COLUMN IF NOT EXISTS draws integer;
ALTER TABLE na_tank_snapshots ADD COLUMN IF NOT EXISTS draws integer;
ALTER TABLE asia_tank_snapshots ADD COLUMN IF NOT EXISTS draws integer;
