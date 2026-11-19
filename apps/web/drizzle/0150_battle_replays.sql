-- One archived replay per recorder, rather than one per battle.
--
-- Written by hand, like every migration since the per-region factories.
-- Additive: a new table, filled from the replays already archived, which keep
-- their files and their keys. `*_battles.replay_key` and `replay_by` stay and
-- keep naming a battle's first file, which is what the readers that only ask
-- "is there a replay" (loadouts, positions, retention) already read.
--
-- A battle can carry several recordings: each participant who runs the mod
-- records their own, and each is a different point of view, so the file is
-- keyed on the battle AND its recorder.

CREATE TABLE IF NOT EXISTS "battle_replays" (
  "region" text NOT NULL,
  "arena_unique_id" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "account_id" bigint NOT NULL,
  "key" text NOT NULL,
  "stored_at" timestamp with time zone DEFAULT now() NOT NULL,
  "personal" jsonb,
  "details" jsonb,
  "mark_of_mastery" integer,
  "views" integer DEFAULT 0 NOT NULL,
  "downloads" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "battle_replays_pk" PRIMARY KEY ("region","arena_unique_id","account_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "battle_replays_recorder_idx" ON "battle_replays" ("region","account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "battle_replays_started_idx" ON "battle_replays" ("region","started_at");
--> statement-breakpoint

-- The files already archived. Their economy is the battle's own when the
-- recorder is the first reporter, which is every case at the time of writing;
-- the per-enemy details and the mastery badge are read from the files by
-- `pnpm --filter @unicum.gg/worker backfill-replay-by`.
INSERT INTO "battle_replays" ("region","arena_unique_id","started_at","account_id","key","stored_at","personal")
SELECT 'eu', arena_unique_id, started_at, replay_by, replay_key, coalesce(replay_stored_at, now()),
       CASE WHEN replay_by = reported_by[1] THEN personal END
FROM "eu_battles" WHERE replay_key IS NOT NULL AND replay_by IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "battle_replays" ("region","arena_unique_id","started_at","account_id","key","stored_at","personal")
SELECT 'na', arena_unique_id, started_at, replay_by, replay_key, coalesce(replay_stored_at, now()),
       CASE WHEN replay_by = reported_by[1] THEN personal END
FROM "na_battles" WHERE replay_key IS NOT NULL AND replay_by IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "battle_replays" ("region","arena_unique_id","started_at","account_id","key","stored_at","personal")
SELECT 'asia', arena_unique_id, started_at, replay_by, replay_key, coalesce(replay_stored_at, now()),
       CASE WHEN replay_by = reported_by[1] THEN personal END
FROM "asia_battles" WHERE replay_key IS NOT NULL AND replay_by IS NOT NULL
ON CONFLICT DO NOTHING;
