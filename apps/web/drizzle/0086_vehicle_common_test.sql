-- Vehicles that exist on the Common Test client but not on the region's live
-- one. They join the normal catalogue so slugs, detail and search work on them
-- unchanged; this flag is what the few places that must exclude them read, and
-- what routes their wot-src fetches to the CT branch.
--
-- Not a one-way marker: a vehicle stops being a test one by shipping, and the
-- refresh writes false back when the live branch starts carrying it.
ALTER TABLE "eu_vehicles" ADD COLUMN IF NOT EXISTS "is_common_test" boolean NOT NULL DEFAULT false;
ALTER TABLE "na_vehicles" ADD COLUMN IF NOT EXISTS "is_common_test" boolean NOT NULL DEFAULT false;
ALTER TABLE "asia_vehicles" ADD COLUMN IF NOT EXISTS "is_common_test" boolean NOT NULL DEFAULT false;
