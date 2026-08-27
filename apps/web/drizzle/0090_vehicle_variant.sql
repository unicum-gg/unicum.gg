-- The parallel catalogue a vehicle comes from, spelled as the suffix its name
-- ends with ("IGR" for the cybercafe reissues). Null for a normal vehicle.
--
-- The suffix is already in `name`, which is what keeps slugs unambiguous. This
-- column exists so the tank page can point at the suffix as a term instead of
-- hunting for it in the name: both are produced by the same function, so they
-- cannot disagree.
ALTER TABLE "eu_vehicles" ADD COLUMN IF NOT EXISTS "variant" text;
ALTER TABLE "na_vehicles" ADD COLUMN IF NOT EXISTS "variant" text;
ALTER TABLE "asia_vehicles" ADD COLUMN IF NOT EXISTS "variant" text;

-- Backfill for an environment whose catalogue refresh has already written the
-- suffixed names (which is the case where this was authored). On a database
-- replaying the migrations in order the stored names are still raw i18n keys
-- ending in `_IGR`, these match nothing, and the column stays null until the
-- next vehicles refresh fills it. Both paths end up correct; this one only
-- saves the wait.
UPDATE "eu_vehicles" SET "variant" = 'IGR' WHERE "name" LIKE '% IGR';
UPDATE "na_vehicles" SET "variant" = 'IGR' WHERE "name" LIKE '% IGR';
UPDATE "asia_vehicles" SET "variant" = 'IGR' WHERE "name" LIKE '% IGR';
