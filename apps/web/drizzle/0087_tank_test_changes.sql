-- What the Common Test client changes about a vehicle the live one already has:
-- `previous` is the live value, `next` the test one. This is what the test build
-- is for from a player's point of view, and Wargaming's API carries none of it.
--
-- Rewritten wholesale on every catalogue refresh rather than appended to: a test
-- build gets rebalanced mid-test and vanishes when it ships, so only its current
-- state means anything. `tank_changes` is the opposite, a record of what shipped.
CREATE TABLE IF NOT EXISTS "tank_test_changes" (
  "id" serial PRIMARY KEY,
  "tank_id" bigint NOT NULL,
  "test_version" text NOT NULL,
  "field" text NOT NULL,
  "previous" real,
  "next" real,
  "captured_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "tank_test_changes_tank_idx" ON "tank_test_changes" ("tank_id");
