-- Freeze each Onslaught season's codename + rank-art ordinal on its row, so a
-- past season keeps its own name ("Season of the Jade Dragon") and themed rank
-- icons once a newer season becomes current (the client localization only ever
-- describes the latest as "current"). Stamped by the reconcile while a season is
-- the live one.

ALTER TABLE "eu_onslaught_seasons" ADD COLUMN IF NOT EXISTS "codename" text;
ALTER TABLE "eu_onslaught_seasons" ADD COLUMN IF NOT EXISTS "season_ordinal" text;

ALTER TABLE "na_onslaught_seasons" ADD COLUMN IF NOT EXISTS "codename" text;
ALTER TABLE "na_onslaught_seasons" ADD COLUMN IF NOT EXISTS "season_ordinal" text;

ALTER TABLE "asia_onslaught_seasons" ADD COLUMN IF NOT EXISTS "codename" text;
ALTER TABLE "asia_onslaught_seasons" ADD COLUMN IF NOT EXISTS "season_ordinal" text;
