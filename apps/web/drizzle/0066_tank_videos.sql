-- Community-suggested gameplay videos, one row per battle rather than per
-- video: a stream VOD covers twenty tanks over three hours, so what is worth
-- linking is the minute this tank is played.
--
-- Written by hand, not by `drizzle-kit generate`: the schema uses the
-- `makeXxxTable(region)` factory pattern, which drizzle-kit's AST analyser
-- cannot see into and answers with `DROP TABLE ... CASCADE` on every per-region
-- table. See AGENTS.md.
--
-- Global, unlike `vehicles`. That catalogue is per region because servers ship
-- different tanks; a video of the IS-7 is a video of the IS-7 on all three, so a
-- suggestion made on EU shows on NA and Asia.

CREATE TABLE IF NOT EXISTS "tank_videos" (
  "id" serial PRIMARY KEY NOT NULL,
  "tank_id" integer NOT NULL,
  "video_id" text NOT NULL,
  "start_seconds" integer DEFAULT 0 NOT NULL,
  "title" text NOT NULL,
  "channel_name" text NOT NULL,
  "arena_id" text,
  "mode" text,
  "spawn_team" smallint,
  "result" text,
  "game_version" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "submitted_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" text
);

-- One row per battle. The same video for another tank, or the same tank at
-- another minute, are different rows; the same battle twice is not. This is also
-- what stops a rejected submission being queued again: the row stays.
CREATE UNIQUE INDEX IF NOT EXISTS "tank_videos_battle_idx"
  ON "tank_videos" ("tank_id", "video_id", "start_seconds");

-- The tab's own read: this tank's approved videos.
CREATE INDEX IF NOT EXISTS "tank_videos_tank_status_idx"
  ON "tank_videos" ("tank_id", "status");

-- The moderation queue, oldest first.
CREATE INDEX IF NOT EXISTS "tank_videos_status_submitted_idx"
  ON "tank_videos" ("status", "submitted_at");
