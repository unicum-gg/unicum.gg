-- The field modifications a vehicle carried, as the replay packs them.
--
-- Stored RAW, exactly as the recording's header gives it, and decoded when it
-- is read. Decoding needs the vehicle's own post-progression tree, and a replay
-- names twelve or thirteen vehicles with modifications; doing it on the upload
-- path would mean a dozen catalogue lookups per file, on the one request a
-- player is waiting on. The packed value is three small integers at most, it
-- cannot go stale, and the read path already holds those trees warm.
--
-- `bigint[]` and not `integer[]`: a word is 28 bits of payload shifted up by
-- four, so a single word reaches 2^32 and a vehicle deep into its tree carries
-- several.
--
-- This column is also why a row now exists for vehicles that have no loadout at
-- all. A replay carries the full fitted loadout for one or two players -- the
-- recorder, and whoever they spectated -- but it carries field modifications
-- for everybody who has any, which is about forty percent of the thirty. The
-- table means "what this battle told us about this vehicle's build", and for
-- most rows that will be this column and nothing else.

ALTER TABLE eu_battle_loadouts   ADD COLUMN IF NOT EXISTS field_mods_packed bigint[];
ALTER TABLE na_battle_loadouts   ADD COLUMN IF NOT EXISTS field_mods_packed bigint[];
ALTER TABLE asia_battle_loadouts ADD COLUMN IF NOT EXISTS field_mods_packed bigint[];
