-- CONCURRENTLY so existing reads/writes aren't blocked. Cannot run inside a
-- transaction, so apply via `psql "$DATABASE_URL" -f drizzle/0010_*.sql`
-- with one statement at a time (psql auto-commit is on by default).

CREATE INDEX CONCURRENTLY IF NOT EXISTS eu_players_lower_nickname_idx
  ON eu_players (LOWER(nickname));

CREATE INDEX CONCURRENTLY IF NOT EXISTS na_players_lower_nickname_idx
  ON na_players (LOWER(nickname));

CREATE INDEX CONCURRENTLY IF NOT EXISTS asia_players_lower_nickname_idx
  ON asia_players (LOWER(nickname));
