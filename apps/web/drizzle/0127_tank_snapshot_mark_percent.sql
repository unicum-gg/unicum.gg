-- The mark of excellence percentage, kept per snapshot.
--
-- `marks_on_gun` beside it has always been the COUNT, 0 to 3, scraped from the
-- WoT portal. This is the progress between those steps, and it is the figure a
-- player grinding a mark actually watches. It exists in exactly one place in
-- the world -- the vehicle dossier inside their own client -- so it reaches us
-- from the mod and from nowhere else. Wargaming's public API does not carry it
-- and neither does the portal.
--
-- On the SNAPSHOT and not only on the current row, because we already take a
-- snapshot per refresh: a column here turns that series into the history of a
-- mark being earned, at no extra cost and with no new table.
--
-- `real` because the dossier knows hundredths. The figure a battle reports
-- rounds to the whole percent, and rounding is precisely what makes a slow
-- climb look like it has stalled.
--
-- Null is "no client has told us", which is nearly every row and every account
-- that does not run the mod. It is not zero, and an aggregate that read it as
-- zero would turn a silent majority into a crowd of beginners.

ALTER TABLE eu_tank_snapshots   ADD COLUMN IF NOT EXISTS mark_percent real;
ALTER TABLE na_tank_snapshots   ADD COLUMN IF NOT EXISTS mark_percent real;
ALTER TABLE asia_tank_snapshots ADD COLUMN IF NOT EXISTS mark_percent real;
