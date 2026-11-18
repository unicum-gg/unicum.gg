-- The part an event's bot plays in it, as the client tags it (`hwrole_boss`,
-- `lsrole_sentry`, ...), stripped to the role itself. Null for every vehicle a
-- player can drive.
--
-- Bots and bosses used to be stored `is_hidden`, which kept them out of every
-- surface, slugs included, so a boss had no page and nothing could show its
-- model. They now join the catalogue like any vehicle, and this is what lets
-- the few places that must tell them apart (the catalogue's event filter, the
-- tabs their page offers) do so. Filled by the next vehicles refresh.
ALTER TABLE "eu_vehicles" ADD COLUMN IF NOT EXISTS "event_role" text;
ALTER TABLE "na_vehicles" ADD COLUMN IF NOT EXISTS "event_role" text;
ALTER TABLE "asia_vehicles" ADD COLUMN IF NOT EXISTS "event_role" text;
