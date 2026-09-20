-- Reverse lookup on the tournament rosters: given a nickname nobody carries
-- anymore, find the account that entered under it. This is the archive of past
-- names the rename history cannot hold, since that one only records a rename we
-- watched happen: on EU it carries 462 rows against 147,800 distinct roster
-- nicknames no player answers to today, 30,934 of which already point at an
-- account we track. Every one of those was a link into a 404, because a team
-- page falls back to the recorded name for an account we do not track yet.
--
-- Without the index the lookup seq-scans 4.5M roster rows on EU, and a miss is
-- the common case: any unknown nickname (a typo, a bot, a scraper) reaches this
-- path after the players table and Wargaming have both come up empty.
--
-- Indexed on LOWER(nickname) to match the lookup, which is case-insensitive
-- like the `players` and `player_name_history` ones it comes after.
-- CONCURRENTLY so the mirror crons keep writing while it builds. Cannot run
-- inside a transaction block, so apply this file with psql rather than through
-- the migrate runner.
-- A concurrent build that fails or is cancelled leaves the index PRESENT and
-- invalid, and `IF NOT EXISTS` then reads it as done: the file succeeds, the
-- ANALYZE succeeds, and the lookup keeps seq-scanning with nothing saying so.
-- So a leftover is dropped first. Outside the CREATEs, since a DO block is a
-- transaction and CONCURRENTLY may not run in one.
DO $$
DECLARE stale text;
BEGIN
  FOR stale IN
    SELECT c.relname
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE NOT i.indisvalid
       AND c.relname LIKE '%_tournament_team_players_nickname_lower_idx'
  LOOP
    EXECUTE format('DROP INDEX %I', stale);
  END LOOP;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS eu_tournament_team_players_nickname_lower_idx
  ON eu_tournament_team_players (LOWER(nickname));
CREATE INDEX CONCURRENTLY IF NOT EXISTS na_tournament_team_players_nickname_lower_idx
  ON na_tournament_team_players (LOWER(nickname));
CREATE INDEX CONCURRENTLY IF NOT EXISTS asia_tournament_team_players_nickname_lower_idx
  ON asia_tournament_team_players (LOWER(nickname));

-- An expression index has no statistics until the table is analysed, and
-- without them the planner costs the lookup as if the name matched thousands of
-- rosters: it walked the tournaments by date instead and took 1.6s where the
-- index answers in 0.7ms. Measured, not precautionary.
ANALYZE eu_tournament_team_players;
ANALYZE na_tournament_team_players;
ANALYZE asia_tournament_team_players;
