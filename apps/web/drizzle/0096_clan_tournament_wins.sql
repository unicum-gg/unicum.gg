-- Tournament honours on the clan row.
--
-- The clan twin of `0095`, denormalised for the same reason: the crest beside a
-- tag is drawn on every board, and resolving a win from the archive would walk
-- every roster on each render. A clan's win is a win by a team ATTRIBUTED to it,
-- which is the `clan_id` migration `0094` put on the team row.
--
-- Purely additive, safe to apply while the app is serving. Written by
-- `recordTournamentWinners` when a tournament settles, and by
-- `pnpm --filter @unicum.gg/worker backfill-tournament-wins`.

ALTER TABLE "eu_clans" ADD COLUMN IF NOT EXISTS "tournament_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "eu_clans" ADD COLUMN IF NOT EXISTS "tournament_featured_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "eu_clans" ADD COLUMN IF NOT EXISTS "tournament_best_title" text;
ALTER TABLE "eu_clans" ADD COLUMN IF NOT EXISTS "tournament_best_at" timestamp with time zone;

ALTER TABLE "na_clans" ADD COLUMN IF NOT EXISTS "tournament_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "na_clans" ADD COLUMN IF NOT EXISTS "tournament_featured_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "na_clans" ADD COLUMN IF NOT EXISTS "tournament_best_title" text;
ALTER TABLE "na_clans" ADD COLUMN IF NOT EXISTS "tournament_best_at" timestamp with time zone;

ALTER TABLE "asia_clans" ADD COLUMN IF NOT EXISTS "tournament_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "asia_clans" ADD COLUMN IF NOT EXISTS "tournament_featured_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "asia_clans" ADD COLUMN IF NOT EXISTS "tournament_best_title" text;
ALTER TABLE "asia_clans" ADD COLUMN IF NOT EXISTS "tournament_best_at" timestamp with time zone;
