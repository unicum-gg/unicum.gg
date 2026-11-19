-- Comments under a battle's replay, moderated before they are shown.
--
-- Written by hand rather than generated, like every migration since the
-- per-region factories: `drizzle-kit generate` cannot read them and would treat
-- every `eu_*`/`na_*`/`asia_*` table as unknown. Everything below is purely
-- additive: nothing here drops, renames or rewrites an existing object.
--
-- One global table rather than one per region: a battle is addressed by its
-- region and its id together, and comments are far too few for three tables.

CREATE TABLE IF NOT EXISTS "battle_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "region" text NOT NULL,
  "arena_unique_id" text NOT NULL,
  "user_id" text NOT NULL,
  "author_region" text NOT NULL,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "body" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" text
);
--> statement-breakpoint

-- A comment is the person, so it goes when they do, like an opinion.
DO $$ BEGIN
  ALTER TABLE "battle_comments"
    ADD CONSTRAINT "battle_comments_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- The battle page's own read: one battle's published comments.
CREATE INDEX IF NOT EXISTS "battle_comments_battle_idx"
  ON "battle_comments" ("region","arena_unique_id","status");
--> statement-breakpoint
-- An author's own comments, still waiting or not.
CREATE INDEX IF NOT EXISTS "battle_comments_user_idx"
  ON "battle_comments" ("user_id");
