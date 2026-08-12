-- Competitive strats. A video row stops being "a battle in a tank" and becomes
-- "a battle on a map, in a format, from a side": Clan Wars, Advances,
-- skirmishes, Maneuvers, Onslaught and tournaments are all played on the random
-- map pool, so nothing but the submitter knows which one it was.
ALTER TABLE "tank_videos" ADD COLUMN IF NOT EXISTS "format" text NOT NULL DEFAULT 'random';

-- A strat is not about a vehicle. Kept whenever it is known, so the tank's own
-- page can still show the battle, but no longer required.
ALTER TABLE "tank_videos" ALTER COLUMN "tank_id" DROP NOT NULL;

-- Only where the format does not fix them (a skirmish, Maneuvers, a tournament).
ALTER TABLE "tank_videos" ADD COLUMN IF NOT EXISTS "team_size" smallint;
ALTER TABLE "tank_videos" ADD COLUMN IF NOT EXISTS "tier" smallint;

-- The clan the battle was played for, as a region and a WG clan id rather than a
-- tag: tags are renamed, ids are not.
ALTER TABLE "tank_videos" ADD COLUMN IF NOT EXISTS "clan_region" text;
ALTER TABLE "tank_videos" ADD COLUMN IF NOT EXISTS "clan_id" integer;

-- The "same battle twice" guard, rebuilt for a nullable tank id. Under the
-- default rule two null tank ids never collide, so the index would quietly stop
-- covering exactly the rows that have no second key to fall back on.
DROP INDEX IF EXISTS "tank_videos_battle_idx";
CREATE UNIQUE INDEX "tank_videos_battle_idx"
  ON "tank_videos" ("tank_id", "video_id", "start_seconds") NULLS NOT DISTINCT;

-- The map page's read: this arena's approved strats.
CREATE INDEX IF NOT EXISTS "tank_videos_arena_status_idx"
  ON "tank_videos" ("arena_id", "status");
