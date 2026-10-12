-- The marks of excellence a player has on each of their tanks.
--
-- Two columns, because the count and the progress answer different questions
-- and arrive with different precision. `marks` is 0 to 3, the same figure the
-- WoT portal gives and that `{region}_tank_snapshots.marks_on_gun` already
-- holds -- but that one is scraped a page at a time, only when somebody visits
-- a profile, against a portal capped near one request a second. This one comes
-- with the garage sweep, for the whole fleet in one go.
--
-- `mark_percent` is the figure the site has never had. Until now the progress
-- towards the next mark was ESTIMATED, by dividing a player's average combined
-- damage by the threshold mirrored in `{region}_tank_moe`. That is a fair guess
-- and it is not the number the client shows. The real one lives in the vehicle
-- dossier as `damageRating`, in hundredths of a percent, and nothing but the
-- client itself can read it.
--
-- `real` and not an integer: the dossier knows hundredths, and the whole point
-- of carrying the precise value is that rounding to the percent is what makes
-- a slow climb look like it has stopped. The battle results round; this does
-- not.
--
-- Nullable, and null is not zero. Null is "no client has told us", which is
-- every row today and every row of a player who has not updated the mod. Zero
-- is a gun that genuinely has no progress. An aggregate must exclude the nulls
-- rather than read them as beginners.

ALTER TABLE eu_tank_loadouts   ADD COLUMN IF NOT EXISTS marks smallint;
ALTER TABLE na_tank_loadouts   ADD COLUMN IF NOT EXISTS marks smallint;
ALTER TABLE asia_tank_loadouts ADD COLUMN IF NOT EXISTS marks smallint;

ALTER TABLE eu_tank_loadouts   ADD COLUMN IF NOT EXISTS mark_percent real;
ALTER TABLE na_tank_loadouts   ADD COLUMN IF NOT EXISTS mark_percent real;
ALTER TABLE asia_tank_loadouts ADD COLUMN IF NOT EXISTS mark_percent real;
