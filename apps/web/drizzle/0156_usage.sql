-- The usage figures: which days each signed-in account was seen, and the
-- day-by-day readings nobody else keeps (the bot's servers and commands).
-- Written by hand for the reason 0152 gives (see AGENTS.md, Database
-- migrations). Two new global tables, so nothing waits on a lock.
CREATE TABLE IF NOT EXISTS "user_activity_day" (
  "day" date NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  PRIMARY KEY ("day", "user_id")
);

CREATE TABLE IF NOT EXISTS "usage_daily" (
  "day" date NOT NULL,
  "metric" text NOT NULL,
  "key" text NOT NULL DEFAULT '',
  "value" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("day", "metric", "key")
);

-- Seed the activity from the sessions still on record. A session's creation
-- and its last extension are each a day its account really was on the site, so
-- these rows are true, only incomplete: the days in between were not written
-- down by anything. That makes the series before this migration a floor rather
-- than a count, which the page says.
INSERT INTO "user_activity_day" ("day", "user_id")
SELECT DISTINCT d::date, user_id
FROM "session", LATERAL (VALUES (created_at), (updated_at)) AS v(d)
ON CONFLICT DO NOTHING;
