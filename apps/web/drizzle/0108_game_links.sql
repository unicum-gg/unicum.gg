-- A World of Tanks client linked to a unicum.gg account (the mod), keyed on the
-- SHA-256 of a secret only the client holds. See
-- packages/shared/src/db/schema/game-links.ts.
--
-- Written by hand rather than by `drizzle-kit generate`: the schema uses the
-- `makeXxxTable(region)` factory pattern, which drizzle-kit's AST analyser
-- cannot see into and answers with `DROP TABLE ... CASCADE` on every per-region
-- table. See AGENTS.md.

CREATE TABLE IF NOT EXISTS "game_links" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "game_links_user_id_idx" ON "game_links" ("user_id");
