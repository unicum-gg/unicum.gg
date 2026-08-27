-- Rows that are not vehicles: the training-room bots, the story-mode coastal
-- bunkers, and the shelling prop the client never names. Zero battles on every
-- region. Every catalogue surface leaves them out: no slug, no listing, no
-- search hit, no detail page.
--
-- The cybercafe IGR reissues are NOT this. They are real vehicles with real
-- stats (2343 ASIA accounts have battles on the 47 of them), and they stay in
-- the catalogue under a suffixed name ("WZ-132 IGR") so they no longer collide
-- with the tank they reissue.
ALTER TABLE "eu_vehicles" ADD COLUMN IF NOT EXISTS "is_hidden" boolean NOT NULL DEFAULT false;
ALTER TABLE "na_vehicles" ADD COLUMN IF NOT EXISTS "is_hidden" boolean NOT NULL DEFAULT false;
ALTER TABLE "asia_vehicles" ADD COLUMN IF NOT EXISTS "is_hidden" boolean NOT NULL DEFAULT false;

-- Backfill from what the rows already show. Until now these vehicles were hidden
-- by a name heuristic at read time ("a real tank name has no underscore"), which
-- this column replaces; seeding it from that same test means the catalogue keeps
-- hiding exactly what it hides today, instead of exposing them under their raw
-- i18n key for the hours between this deploy and the next vehicles refresh.
--
-- It deliberately over-hides: it also catches the IGR reissues, whose stored
-- name is still the raw key. That is the point. The next refresh writes their
-- real suffixed name and sets is_hidden back to false in the same statement, so
-- they surface named rather than surfacing as `Ch17_WZ131_1_WZ132_IGR`.
UPDATE "eu_vehicles" SET "is_hidden" = true WHERE "name" LIKE '%\_%' OR "name" LIKE '%VehicleType%';
UPDATE "na_vehicles" SET "is_hidden" = true WHERE "name" LIKE '%\_%' OR "name" LIKE '%VehicleType%';
UPDATE "asia_vehicles" SET "is_hidden" = true WHERE "name" LIKE '%\_%' OR "name" LIKE '%VehicleType%';
