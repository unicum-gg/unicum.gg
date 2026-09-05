-- Tournament honours on the player row.
--
-- Denormalised so the crest beside a nickname costs nothing: every board and
-- every table that shows a player already reads this row, and resolving a win
-- from the archive would walk every roster on each render. Purely additive, so
-- it is safe to apply while the app is serving.
--
-- Written by `recordTournamentWinners` when a tournament settles, and by
-- `pnpm --filter @unicum.gg/worker backfill-tournament-wins` for the archive.

ALTER TABLE "eu_players" ADD COLUMN IF NOT EXISTS "tournament_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "eu_players" ADD COLUMN IF NOT EXISTS "tournament_featured_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "eu_players" ADD COLUMN IF NOT EXISTS "tournament_best_title" text;
ALTER TABLE "eu_players" ADD COLUMN IF NOT EXISTS "tournament_best_at" timestamp with time zone;

ALTER TABLE "na_players" ADD COLUMN IF NOT EXISTS "tournament_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "na_players" ADD COLUMN IF NOT EXISTS "tournament_featured_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "na_players" ADD COLUMN IF NOT EXISTS "tournament_best_title" text;
ALTER TABLE "na_players" ADD COLUMN IF NOT EXISTS "tournament_best_at" timestamp with time zone;

ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "tournament_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "tournament_featured_wins" integer NOT NULL DEFAULT 0;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "tournament_best_title" text;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "tournament_best_at" timestamp with time zone;
