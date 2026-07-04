-- Prefix-search indexes powering the local-first search dialog. The
-- `text_pattern_ops` opclass turns `LOWER(nickname) LIKE 'x%'` (and the clan
-- `tag_lower LIKE 'x%'`) into a range scan regardless of the DB collation, so
-- the local branch of search never sequential-scans the multi-million-row
-- players table. Created CONCURRENTLY so the ~2M-row build does not lock writes.

CREATE INDEX CONCURRENTLY IF NOT EXISTS eu_players_nickname_prefix_idx ON eu_players (LOWER(nickname) text_pattern_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS na_players_nickname_prefix_idx ON na_players (LOWER(nickname) text_pattern_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS asia_players_nickname_prefix_idx ON asia_players (LOWER(nickname) text_pattern_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS eu_clans_tag_prefix_idx ON eu_clans (tag_lower text_pattern_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS na_clans_tag_prefix_idx ON na_clans (tag_lower text_pattern_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS asia_clans_tag_prefix_idx ON asia_clans (tag_lower text_pattern_ops);
