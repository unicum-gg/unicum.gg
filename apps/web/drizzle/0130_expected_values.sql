-- The last expected-values table we successfully read, per rating.
--
-- WN8's and WNX's per-tank tables are read on the way to rendering any player
-- page and both come from third parties we do not run. On 2026-10-14 XVM's host
-- answered Cloudflare 521 (their own origin refusing connections) and every
-- profile on the site answered 500 for as long as it was down, because the
-- fetcher threw and nothing stood behind it.
--
-- This holds our own last good read rather than a copy committed to the
-- repository. Measured against the archive, all 781 tanks common to two
-- captures ten months apart had moved their expected damage (median 0.37%,
-- p99 6.26%), so a committed table is wrong the next day and stays wrong until
-- somebody remembers it exists. A row written by the act of fetching is at most
-- an hour behind and maintained by nothing.
--
-- In Postgres rather than Redis for the reason `changelog_state` records: the
-- instance runs `allkeys-lru`, a key with no TTL is evicted like any other, and
-- a value read only while an origin is down is the least recently used key
-- there is. It would be missing exactly when it is wanted.
CREATE TABLE IF NOT EXISTS "expected_values" (
  "source" text PRIMARY KEY NOT NULL,
  "payload" jsonb NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
