-- How far the changelog has been published, as the last commit it covered.
--
-- Written by hand rather than by `drizzle-kit generate`: the schema uses the
-- `makeXxxTable(region)` factory pattern, which drizzle-kit's AST analyser
-- cannot see into and answers with `DROP TABLE ... CASCADE` on every per-region
-- table. See AGENTS.md.
--
-- Moved off Redis, where it lived as a single key. Redis survives a redeploy,
-- which was the original reasoning, but not its own eviction policy: the
-- instance runs `allkeys-lru` at its 2 GiB ceiling (1.45M keys evicted over one
-- uptime), where a key with no TTL is evicted like any other. Read once a day,
-- this was among the least recently used keys in a store it shares with the ISR
-- page cache. It was evicted between two runs, so the second one read nothing,
-- fell back to its 48h window, and posted the previous day's entries again.
--
-- Singleton, like `cron_leader`: one global fact, and the check constraint makes
-- a second row impossible rather than merely unlikely.

CREATE TABLE IF NOT EXISTS "changelog_state" (
  "id" integer PRIMARY KEY NOT NULL,
  "last_published_sha" text NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "changelog_state_singleton" CHECK ("id" = 1)
);

-- Carry over where Redis had got to, so the cutover publishes nothing twice.
-- An empty table reads as "nothing published yet", which is the very fallback
-- this migration exists to stop.
--
-- The value is the commit the 2026-08-11 post covered, read out of the Redis key
-- being retired. It is only correct until the next post goes out: if this is
-- applied after one, replace it with the last published commit first.
INSERT INTO "changelog_state" ("id", "last_published_sha")
VALUES (1, 'bf6376763a633b88c24ad7f2d8b8606ad3a87d72')
ON CONFLICT ("id") DO NOTHING;
