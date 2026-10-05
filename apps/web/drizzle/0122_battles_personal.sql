-- What a battle earned the client that reported it.
--
-- Its own column rather than a field inside `vehicles`, because it is not a
-- fact about a vehicle and not a fact about the battle: the results carry it
-- under `personal.<vehicle>`, for the reporting account alone, and the other
-- twenty-nine players have no economy in the payload at any price. Credits,
-- experience, bonds, what the repair and the resupply cost, whether the
-- account had premium.
--
-- Null for every battle recorded before the mod sent it, and null for a battle
-- reported by somebody else: there is no version of this row where the figure
-- exists for more than one of its thirty players. The site shows it only on
-- the page of the player it belongs to, which is also the only page where it
-- means anything.
--
-- `reported_by` already says whose it is: a battle's `personal` belongs to the
-- first account in that array, the one whose upload created the row. A second
-- reporter adds their id and leaves the economy alone, because it is not
-- theirs to overwrite.

ALTER TABLE eu_battles   ADD COLUMN IF NOT EXISTS personal jsonb;
ALTER TABLE na_battles   ADD COLUMN IF NOT EXISTS personal jsonb;
ALTER TABLE asia_battles ADD COLUMN IF NOT EXISTS personal jsonb;
