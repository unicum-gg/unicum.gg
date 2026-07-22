-- Snapshot-pipeline claim: replace the non-sargable due predicate with an
-- indexed `due_at` column.
--
-- WHY. The claim filtered `last_seen_at < refreshCutoffSql(last_battle_at)` — a
-- CASE that compares two columns, so no index can serve it and every claim
-- seq-scanned the whole players table. Under the continuous backlog+active
-- workers x 3 regions that pegged Postgres at ~2.5 cores (each claim 4-6s,
-- observed in the slow-query log), which is what made the whole site — tank
-- pages included — slow. `due_at` = `last_seen_at + cadence(last_battle_at)`,
-- so "due" becomes the sargable `due_at <= NOW()` and range-scans an index.
--
-- SAFETY / ORDER OF OPERATIONS.
--   * Apply this migration while the OLD code is still running. The old claim
--     ignores `due_at`, so the momentary all-epoch state after ADD COLUMN and
--     the backfill below cause no behaviour change; only AFTER this is applied
--     do you deploy the new code that reads `due_at`.
--   * The backfill sets each existing row's real next-due time (last_seen_at +
--     its cadence), so switching to `WHERE due_at <= NOW()` preserves exactly
--     today's due set — no "everything is due at once" storm.
--   * Run WITHOUT --single-transaction: CREATE INDEX CONCURRENTLY cannot run in
--     a transaction block. `psql "$DATABASE_URL" -f 0048_players_due_at.sql`.
--   * The backfill UPDATE rewrites every row (~2M x 3). It is heavy on an
--     already-loaded DB but one-time; run it off-peak if you can.

-- 1) Column. NOT NULL DEFAULT 'epoch' is a constant, so this is an instant
--    metadata change (no table rewrite). Epoch = "immediately due", which is
--    also the right default for freshly-discovered rows (fetch ASAP).
ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "due_at" timestamptz NOT NULL DEFAULT 'epoch'::timestamptz;
ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "due_at" timestamptz NOT NULL DEFAULT 'epoch'::timestamptz;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "due_at" timestamptz NOT NULL DEFAULT 'epoch'::timestamptz;

-- 2) Backfill: due_at = last_seen_at + cadence(last_battle_at). Mirror of
--    dueAtSql / refreshCutoffSql in packages/shared/src/players/refresh-policy.ts
--    (all three must move together). Unfetched (last_battle_at IS NULL) stays
--    epoch = perpetually due, top priority.
UPDATE "eu_players" SET "due_at" = CASE
  WHEN "last_battle_at" IS NULL                          THEN 'epoch'::timestamptz
  WHEN "last_battle_at" > NOW() - INTERVAL '24 hours'    THEN "last_seen_at" + INTERVAL '6 hours'
  WHEN "last_battle_at" > NOW() - INTERVAL '7 days'      THEN "last_seen_at" + INTERVAL '24 hours'
  WHEN "last_battle_at" > NOW() - INTERVAL '30 days'     THEN "last_seen_at" + INTERVAL '3 days'
  WHEN "last_battle_at" > NOW() - INTERVAL '90 days'     THEN "last_seen_at" + INTERVAL '7 days'
  WHEN "last_battle_at" > NOW() - INTERVAL '365 days'    THEN "last_seen_at" + INTERVAL '30 days'
  ELSE "last_seen_at" + INTERVAL '90 days'
END;
UPDATE "na_players" SET "due_at" = CASE
  WHEN "last_battle_at" IS NULL                          THEN 'epoch'::timestamptz
  WHEN "last_battle_at" > NOW() - INTERVAL '24 hours'    THEN "last_seen_at" + INTERVAL '6 hours'
  WHEN "last_battle_at" > NOW() - INTERVAL '7 days'      THEN "last_seen_at" + INTERVAL '24 hours'
  WHEN "last_battle_at" > NOW() - INTERVAL '30 days'     THEN "last_seen_at" + INTERVAL '3 days'
  WHEN "last_battle_at" > NOW() - INTERVAL '90 days'     THEN "last_seen_at" + INTERVAL '7 days'
  WHEN "last_battle_at" > NOW() - INTERVAL '365 days'    THEN "last_seen_at" + INTERVAL '30 days'
  ELSE "last_seen_at" + INTERVAL '90 days'
END;
UPDATE "asia_players" SET "due_at" = CASE
  WHEN "last_battle_at" IS NULL                          THEN 'epoch'::timestamptz
  WHEN "last_battle_at" > NOW() - INTERVAL '24 hours'    THEN "last_seen_at" + INTERVAL '6 hours'
  WHEN "last_battle_at" > NOW() - INTERVAL '7 days'      THEN "last_seen_at" + INTERVAL '24 hours'
  WHEN "last_battle_at" > NOW() - INTERVAL '30 days'     THEN "last_seen_at" + INTERVAL '3 days'
  WHEN "last_battle_at" > NOW() - INTERVAL '90 days'     THEN "last_seen_at" + INTERVAL '7 days'
  WHEN "last_battle_at" > NOW() - INTERVAL '365 days'    THEN "last_seen_at" + INTERVAL '30 days'
  ELSE "last_seen_at" + INTERVAL '90 days'
END;

-- 3) The index that makes the claim sargable. CONCURRENTLY so it never locks the
--    live table; IF NOT EXISTS so re-running is a no-op.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "eu_players_due_at_idx"   ON "eu_players"   ("due_at" ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "na_players_due_at_idx"   ON "na_players"   ("due_at" ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "asia_players_due_at_idx" ON "asia_players" ("due_at" ASC);
