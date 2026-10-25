-- Wargaming's two account ratings, Personal Rating and the World of Tanks
-- Rating, become selectable beside WN7/WN8/WNX.
--
-- Both are already recorded on every snapshot (`global_rating`, `wtr`). What is
-- missing is the copy on the PLAYER row the three WN ratings already have, which
-- is what lets the boards, the clan averages and the distributions rank a
-- region in one indexed read instead of a DISTINCT ON over the snapshots. So
-- this adds that copy and its two neighbours, and nothing that is per vehicle
-- or per window: neither rating exists at either grain (see `RatingMetric`).
--
--   *_players               pr, wtr       written by the snapshot path
--   *_player_ratings        pr, wtr       the by-language boards
--   *_player_distribution   pr, wtr       the /servers histograms
--
-- `top_clans`, `clan_ratings`, `player_activity` and `tier_winrate` key their
-- rows on a text `metric` and need no change: they simply gain 'pr'/'wtr' rows.
--
-- Every column is nullable with no default, so each ALTER is a catalogue change
-- and rewrites nothing, which matters on a 2-million-row `eu_players`. The
-- player rows fill on each account's next snapshot, and
-- `pnpm --filter @unicum.gg/worker backfill-account-ratings` copies the latest
-- snapshot's values across for the rest.
--
-- The distribution columns are nullable for the same reason, and because the
-- singleton row already exists: NOT NULL would refuse the ALTER until the next
-- hourly pass rewrote it. The reader treats a null as an empty histogram.
--
-- Additive only, no per-region DROP (the schema factory pattern makes
-- drizzle-kit blind to these tables, so this is written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format('ALTER TABLE %1$I_players ADD COLUMN IF NOT EXISTS pr integer', r);
    EXECUTE format('ALTER TABLE %1$I_players ADD COLUMN IF NOT EXISTS wtr integer', r);
    EXECUTE format('ALTER TABLE %1$I_player_ratings ADD COLUMN IF NOT EXISTS pr real', r);
    EXECUTE format('ALTER TABLE %1$I_player_ratings ADD COLUMN IF NOT EXISTS wtr real', r);
    EXECUTE format('ALTER TABLE %1$I_player_distribution ADD COLUMN IF NOT EXISTS pr jsonb', r);
    EXECUTE format('ALTER TABLE %1$I_player_distribution ADD COLUMN IF NOT EXISTS wtr jsonb', r);
  END LOOP;
END $$;
